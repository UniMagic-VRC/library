#!/usr/bin/env node

import { constants as fsConstants, createReadStream } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  lstat,
  mkdtemp,
  rename,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const MAX_COMMAND_OUTPUT = 16 * 1024 * 1024;

class SanitizerError extends Error {}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: options.encoding ?? "utf8",
    maxBuffer: MAX_COMMAND_OUTPUT,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const allowedStatuses = options.allowedStatuses ?? [0];

  if (result.error) {
    throw new SanitizerError(
      options.failureMessage ?? `Unable to execute ${JSON.stringify(command)}: ${result.error.message}`,
    );
  }
  if (!allowedStatuses.includes(result.status)) {
    throw new SanitizerError(
      options.failureMessage ??
        `${JSON.stringify(command)} exited with status ${result.status ?? "unknown"}`,
    );
  }
  if (result.status !== 0 && result.stderr) {
    console.warn(result.stderr.toString());
  }

  return result.stdout;
}

function git(repoRoot, args, options = {}) {
  return run("git", args, { cwd: repoRoot, ...options });
}

function stagedPdfPaths(repoRoot) {
  const output = git(
    repoRoot,
    [
      "diff",
      "--cached",
      "--name-only",
      "-z",
      "--diff-filter=ACMR",
      "--find-renames",
      "--",
    ],
    { encoding: "buffer", failureMessage: "Unable to inspect staged paths" },
  );

  return output
    .toString("utf8")
    .split("\0")
    .filter((path) => path.length > 0 && /\.pdf$/iu.test(path));
}

function assertNoUnstagedDivergence(repoRoot, relativePath) {
  const result = spawnSync("git", ["diff", "--quiet", "--", relativePath], {
    cwd: repoRoot,
    stdio: "ignore",
  });

  if (result.error) {
    throw new SanitizerError(
      `Unable to compare staged and worktree versions of ${JSON.stringify(relativePath)}: ${result.error.message}`,
    );
  }
  if (result.status === 1) {
    throw new SanitizerError(
      `Refusing to sanitize ${JSON.stringify(relativePath)} because it has unstaged changes`,
    );
  }
  if (result.status !== 0) {
    throw new SanitizerError(
      `Unable to compare staged and worktree versions of ${JSON.stringify(relativePath)} (git exited with status ${result.status ?? "unknown"})`,
    );
  }
}

async function inspectCandidate(repoRoot, relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  const pathFromRoot = relative(repoRoot, absolutePath);
  if (
    isAbsolute(pathFromRoot) ||
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`)
  ) {
    throw new SanitizerError(`Staged path escapes the repository: ${JSON.stringify(relativePath)}`);
  }

  let details;
  try {
    details = await lstat(absolutePath);
    await access(absolutePath, fsConstants.R_OK);
  } catch (error) {
    throw new SanitizerError(
      `Staged PDF is not readable in the worktree: ${JSON.stringify(relativePath)} (${error.message})`,
    );
  }
  if (!details.isFile()) {
    throw new SanitizerError(
      `Staged PDF is not a regular worktree file: ${JSON.stringify(relativePath)}`,
    );
  }

  assertNoUnstagedDivergence(repoRoot, relativePath);
  return {
    absolutePath,
    relativePath,
    mode: details.mode,
    contentHash: await hashFile(absolutePath),
  };
}

function preflightQpdf(qpdf) {
  run(qpdf, ["--version"], {
    failureMessage: `Required qpdf executable is unavailable: ${JSON.stringify(qpdf)}`,
  });
}

async function hashFile(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function restoreSources(replaced) {
  const failures = [];
  for (const candidate of replaced) {
    const recoveryPath = join(
      dirname(candidate.absolutePath),
      `.${basename(candidate.absolutePath)}.metadata-restore-${process.pid}-${randomUUID()}`,
    );
    try {
      await copyFile(candidate.backupPath, recoveryPath);
      await chmod(recoveryPath, candidate.mode);
      await rename(recoveryPath, candidate.absolutePath);
    } catch (error) {
      failures.push(`${JSON.stringify(candidate.relativePath)} (${error.message})`);
      await rm(recoveryPath, { force: true }).catch(() => {});
    }
  }

  if (failures.length > 0) {
    throw new SanitizerError(
      `Failed to restore original PDFs after an error: ${failures.join(", ")}`,
    );
  }
}

async function sanitize() {
  const repoRoot = run("git", ["rev-parse", "--show-toplevel"], {
    failureMessage: "Unable to resolve the Git repository root",
  }).trim();
  const relativePaths = stagedPdfPaths(repoRoot);
  if (relativePaths.length === 0) {
    return;
  }

  const qpdf = process.env.QPDF || "qpdf";
  preflightQpdf(qpdf);

  const candidates = [];
  for (const relativePath of relativePaths) {
    candidates.push(await inspectCandidate(repoRoot, relativePath));
  }

  let tempDir;
  const replacementTemps = [];
  const replaced = [];
  try {
    tempDir = await mkdtemp(join(tmpdir(), "strip-pdf-metadata-"));

    for (const [index, candidate] of candidates.entries()) {
      candidate.outputPath = join(tempDir, `${index}.pdf`);
      candidate.backupPath = join(tempDir, `${index}.original.pdf`);
      run(
        qpdf,
        [candidate.absolutePath, "--remove-info", "--remove-metadata", candidate.outputPath],
        {
          allowedStatuses: [0, 3],
          failureMessage: `qpdf failed while sanitizing ${JSON.stringify(candidate.relativePath)}`,
        },
      );

      const outputDetails = await lstat(candidate.outputPath).catch(() => null);
      if (!outputDetails?.isFile()) {
        throw new SanitizerError(
          `qpdf did not create a regular output file for ${JSON.stringify(candidate.relativePath)}`,
        );
      }
    }

    // qpdf may take long enough for an editor to change a source. Recheck before
    // any worktree file is replaced so those bytes can never be staged silently.
    for (const candidate of candidates) {
      assertNoUnstagedDivergence(repoRoot, candidate.relativePath);
      await copyFile(candidate.absolutePath, candidate.backupPath);
      if ((await hashFile(candidate.backupPath)) !== candidate.contentHash) {
        throw new SanitizerError(
          `Refusing to replace ${JSON.stringify(candidate.relativePath)} because it changed while qpdf was running`,
        );
      }

      const replacementPath = join(
        dirname(candidate.absolutePath),
        `.${basename(candidate.absolutePath)}.metadata-sanitized-${process.pid}-${randomUUID()}`,
      );
      await copyFile(candidate.outputPath, replacementPath);
      await chmod(replacementPath, candidate.mode);
      replacementTemps.push(replacementPath);
      candidate.replacementPath = replacementPath;
    }

    try {
      for (const candidate of candidates) {
        assertNoUnstagedDivergence(repoRoot, candidate.relativePath);
        if ((await hashFile(candidate.absolutePath)) !== candidate.contentHash) {
          throw new SanitizerError(
            `Refusing to replace ${JSON.stringify(candidate.relativePath)} because it changed after replacement preparation`,
          );
        }
        await rename(candidate.replacementPath, candidate.absolutePath);
        replacementTemps.splice(replacementTemps.indexOf(candidate.replacementPath), 1);
        replaced.push(candidate);
      }

      git(repoRoot, ["add", "--", ...relativePaths], {
        failureMessage: "Unable to stage sanitized PDFs",
      });
    } catch (error) {
      await restoreSources(replaced);
      throw error;
    }
  } finally {
    for (const path of replacementTemps) {
      await rm(path, { force: true }).catch(() => {});
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

sanitize().catch((error) => {
  console.error(`PDF metadata sanitization failed: ${error.message}`);
  process.exitCode = 1;
});
