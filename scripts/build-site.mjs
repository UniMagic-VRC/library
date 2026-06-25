import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metaPath = path.join(root, "src", "courses.meta.json");
const materialsDir = path.join(root, "materials");
const siteDir = path.join(root, "site");
const distDir = path.join(root, "dist");
const regularFontPath = path.join(root, "node_modules", "@expo-google-fonts", "noto-sans-jp", "400Regular", "NotoSansJP_400Regular.ttf");
const logoSvgPath = path.join(siteDir, "assets", "unimagic-logo.svg");
const latestMaterialsUrl = "https://unimagic-vrc.github.io/library/";
const qpdfExecutable = process.env.QPDF || "qpdf";
const execFileAsync = promisify(execFile);
const noticeText = "この資料は作成・更新時点の情報に基づいています。ツールやサービスの仕様変更により、内容が古くなっている可能性があります。";
let logoSvgCache;

const errors = [];

async function main() {
  const meta = await readJson(metaPath);
  validateMetaShape(meta);

  const terms = [...meta.terms].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const courses = [...meta.courses].sort((a, b) => a.title.localeCompare(b.title, "ja"));
  const lessonMetaByKey = new Map(meta.lessons.map((lesson) => [lessonKey(lesson.termId, lesson.courseId, lesson.lessonNo), lesson]));
  const materialFilesByKey = await collectMaterialFiles();

  for (const lesson of meta.lessons) {
    const key = lessonKey(lesson.termId, lesson.courseId, lesson.lessonNo);
    if (!materialFilesByKey.has(key)) {
      errors.push(`資料PDFがありません: materials/${lesson.termId}/${lesson.courseId}/${lesson.lessonNo}.pdf`);
    }
  }

  for (const key of materialFilesByKey.keys()) {
    if (!lessonMetaByKey.has(key)) {
      errors.push(`メタデータにない資料ディレクトリがあります: ${key.replaceAll("::", "/")}`);
    }
  }

  failIfErrors();

  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(path.join(distDir, "data"), { recursive: true });
  await copyDir(siteDir, distDir);
  const processedMaterialFilesByKey = await buildMaterials(materialFilesByKey, lessonMetaByKey);

  const latestKeys = latestLessonKeys(meta.lessons, terms);
  const lessons = meta.lessons.map((lesson) => {
    const key = lessonKey(lesson.termId, lesson.courseId, lesson.lessonNo);
    const files = processedMaterialFilesByKey.get(key) || [];
    const fileUpdatedAt = files
      .map((file) => file.updatedAt)
      .sort()
      .at(-1);
    const lastUpdated = lesson.date || fileUpdatedAt;
    return {
      id: key,
      termId: lesson.termId,
      courseId: lesson.courseId,
      lessonNo: lesson.lessonNo,
      title: lesson.title,
      description: lesson.description || "",
      date: lesson.date || null,
      tags: lesson.tags || [],
      lastUpdated,
      isLatestForCourseLesson: latestKeys.has(courseLessonKey(lesson.courseId, lesson.lessonNo, lesson.termId)),
      files: files.map(({ absolutePath, updatedAt, ...file }) => file)
    };
  }).sort((a, b) => {
    const termCompare = termStartsAt(terms, b.termId).localeCompare(termStartsAt(terms, a.termId));
    return termCompare || a.courseId.localeCompare(b.courseId) || a.lessonNo.localeCompare(b.lessonNo, "ja", { numeric: true });
  });

  const catalog = {
    generatedAt: new Date().toISOString(),
    terms,
    courses,
    lessons,
    searchViews: meta.searchViews || []
  };

  await fs.writeFile(path.join(distDir, "data", "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);

  console.log(`Generated ${lessons.length} lessons into ${path.relative(root, distDir)}`);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${filePath} を読み込めません: ${error.message}`);
  }
}

function validateMetaShape(meta) {
  if (!Array.isArray(meta.terms)) errors.push("terms は配列で指定してください。");
  if (!Array.isArray(meta.courses)) errors.push("courses は配列で指定してください。");
  if (!Array.isArray(meta.lessons)) errors.push("lessons は配列で指定してください。");
  if (errors.length) return;

  const termIds = new Set();
  for (const term of meta.terms) {
    requireFields(term, ["id", "label", "startsAt"], "term");
    if (termIds.has(term.id)) errors.push(`term id が重複しています: ${term.id}`);
    termIds.add(term.id);
    validateDate(term.startsAt, `term ${term.id}.startsAt`);
  }

  const courseIds = new Set();
  for (const course of meta.courses) {
    requireFields(course, ["id", "title"], "course");
    if (courseIds.has(course.id)) errors.push(`course id が重複しています: ${course.id}`);
    courseIds.add(course.id);
  }

  const lessonKeys = new Set();
  for (const lesson of meta.lessons) {
    requireFields(lesson, ["termId", "courseId", "lessonNo", "title"], "lesson");
    lesson.lessonNo = normalizeLessonNo(lesson.lessonNo);
    const key = lessonKey(lesson.termId, lesson.courseId, lesson.lessonNo);
    if (lessonKeys.has(key)) errors.push(`lesson が重複しています: ${key}`);
    lessonKeys.add(key);
    if (!termIds.has(lesson.termId)) errors.push(`lesson が未知の termId を参照しています: ${key}`);
    if (!courseIds.has(lesson.courseId)) errors.push(`lesson が未知の courseId を参照しています: ${key}`);
    if (lesson.date) validateDate(lesson.date, `lesson ${key}.date`);
    if (lesson.tags && !Array.isArray(lesson.tags)) errors.push(`lesson tags は配列にしてください: ${key}`);
  }
}

async function collectMaterialFiles() {
  const byKey = new Map();
  if (!(await exists(materialsDir))) return byKey;

  for (const termId of await visibleEntries(materialsDir)) {
    const termPath = path.join(materialsDir, termId);
    if (!(await isDirectory(termPath))) continue;
    for (const courseId of await visibleEntries(termPath)) {
      const coursePath = path.join(termPath, courseId);
      if (!(await isDirectory(coursePath))) continue;
      for (const entry of await visibleEntries(coursePath)) {
        const absolutePath = path.join(coursePath, entry);
        if (await isDirectory(absolutePath)) {
          errors.push(`授業資料は materials/<term>/<course>/<lesson>.pdf に配置してください: materials/${termId}/${courseId}/${entry}`);
          continue;
        }
        if (!entry.endsWith(".pdf")) {
          errors.push(`資料ファイルは .pdf のみ対応しています: materials/${termId}/${courseId}/${entry}`);
          continue;
        }
        const lessonNo = normalizeLessonNo(entry.replace(/\.pdf$/i, ""));
        byKey.set(lessonKey(termId, courseId, lessonNo), [await materialFile(absolutePath, termId, courseId, lessonNo)]);
      }
    }
  }
  return byKey;
}

async function materialFile(absolutePath, termId, courseId, lessonNo) {
  const stat = await fs.stat(absolutePath);
  const name = `${lessonNo}.pdf`;
  return {
    name,
    path: webPath(["materials", termId, courseId, name]),
    size: stat.size,
    updatedAt: toDateOnly(stat.mtime),
    absolutePath
  };
}

async function buildMaterials(materialFilesByKey, lessonMetaByKey) {
  const processedByKey = new Map();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unimagic-pdf-notices-"));

  try {
    for (const [key, files] of materialFilesByKey.entries()) {
      const lesson = lessonMetaByKey.get(key);
      if (!lesson) continue;
      const [termId, courseId] = key.split("::");
      const processedFiles = [];

      for (const file of files) {
        const targetPath = path.join(distDir, ...file.path.split("/").map(decodeURIComponent));
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await addNoticePages({
          sourcePath: file.absolutePath,
          targetPath,
          noticePath: path.join(tempDir, `${termId}-${courseId}-${lesson.lessonNo}.pdf`),
          title: lesson.title,
          lastUpdated: lesson.date,
          contextPath: path.relative(root, file.absolutePath)
        });
        const stat = await fs.stat(targetPath);
        processedFiles.push({
          ...file,
          size: stat.size
        });
      }

      processedByKey.set(key, processedFiles);
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  return processedByKey;
}

async function addNoticePages({ sourcePath, targetPath, noticePath, title, lastUpdated, contextPath }) {
  await createNoticePdf({ sourcePath, noticePath, title, lastUpdated, contextPath });

  await runCommand(
    qpdfExecutable,
    ["--warning-exit-0", "--empty", "--pages", noticePath, sourcePath, noticePath, "--", targetPath],
    `PDF注意ページの挿入に失敗しました: ${contextPath}`
  );
}

async function createNoticePdf({ sourcePath, noticePath, title, lastUpdated, contextPath }) {
  try {
    const [sourceBytes, regularFontBytes] = await Promise.all([
      fs.readFile(sourcePath),
      fs.readFile(regularFontPath)
    ]);
    const sourcePdf = await PDFDocument.load(sourceBytes);
    const firstPage = sourcePdf.getPage(0);
    const { width, height } = firstPage.getSize();

    const noticePdf = await PDFDocument.create();
    noticePdf.registerFontkit(fontkit);
    const regularFont = await noticePdf.embedFont(regularFontBytes, { subset: false });
    const page = noticePdf.addPage([width, height]);

    drawNoticePage(page, {
      width,
      height,
      regularFont,
      title,
      lastUpdated,
      logo: await readLogoSvg()
    });

    await fs.writeFile(noticePath, await noticePdf.save());
  } catch (error) {
    throw new Error(`PDF注意ページの生成に失敗しました: ${contextPath}\n${error.message}`);
  }
}

function drawNoticePage(page, { width, height, regularFont, title, lastUpdated, logo }) {
  const margin = Math.max(42, Math.min(width, height) * 0.08);
  const contentWidth = width - margin * 2;
  const accent = rgb(0.06, 0.2, 0.32);
  const body = rgb(0.14, 0.16, 0.18);
  const muted = rgb(0.38, 0.43, 0.48);
  const rule = rgb(0.78, 0.82, 0.86);
  const label = "UniMagic 資料について";

  const labelSize = fitFontSize(label, regularFont, Math.min(18, height * 0.032), contentWidth);
  const titleSize = fitFontSize(title, regularFont, Math.min(34, height * 0.06), contentWidth);
  const titleLines = wrapText(title, regularFont, titleSize, contentWidth, 2);
  const metaSize = fitFontSize(`最終更新日: ${lastUpdated}`, regularFont, Math.min(18, height * 0.032), contentWidth);
  const bodySize = Math.max(12, Math.min(20, height * 0.033));
  const bodyLines = wrapText(noticeText, regularFont, bodySize, contentWidth, 4);
  const urlLabel = "最新の資料はこちら:";
  const urlLabelSize = Math.max(11, Math.min(16, height * 0.027));
  const urlSize = fitFontSize(latestMaterialsUrl, regularFont, Math.min(18, height * 0.032), contentWidth);
  const titleGap = labelSize * 2.8;
  const ruleTopGap = Math.max(16, height * 0.025);
  const ruleBottomGap = Math.max(24, height * 0.045);
  const noticeGap = metaSize * 2.2;
  const urlTopGap = Math.max(14, height * 0.025);
  const urlGap = urlLabelSize * 1.65;
  const headerOffsetDown = Math.max(32, height * 0.065);
  const ruleY = height - margin - titleGap - titleLines.length * titleSize * 1.35 - ruleTopGap;

  let y = height - margin - headerOffsetDown;
  page.drawText(label, { x: margin, y, size: labelSize, font: regularFont, color: accent });
  y -= titleGap;

  for (const line of titleLines) {
    page.drawText(line, { x: margin, y, size: titleSize, font: regularFont, color: body });
    y -= titleSize * 1.35;
  }

  y = ruleY;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rule });
  y -= ruleBottomGap;

  page.drawText(`最終更新日: ${lastUpdated}`, { x: margin, y, size: metaSize, font: regularFont, color: muted });
  y -= noticeGap;

  for (const line of bodyLines) {
    page.drawText(line, { x: margin, y, size: bodySize, font: regularFont, color: body });
    y -= bodySize * 1.55;
  }

  y -= urlTopGap;
  page.drawText(urlLabel, { x: margin, y, size: urlLabelSize, font: regularFont, color: accent });
  y -= urlGap;

  page.drawText(latestMaterialsUrl, { x: margin, y, size: urlSize, font: regularFont, color: accent });
  page.drawLine({
    start: { x: margin, y: y - 3 },
    end: { x: margin + regularFont.widthOfTextAtSize(latestMaterialsUrl, urlSize), y: y - 3 },
    thickness: 0.8,
    color: accent
  });

  drawLogo(page, { logo, width, margin });
}

async function readLogoSvg() {
  if (!logoSvgCache) {
    logoSvgCache = fs.readFile(logoSvgPath, "utf8").then((svg) => {
      const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1]?.trim().split(/\s+/).map(Number);
      const pathData = svg.match(/<path[^>]*\sd="([^"]+)"/)?.[1];
      if (!viewBox || viewBox.length !== 4 || viewBox.some((value) => Number.isNaN(value)) || !pathData) {
        throw new Error(`${path.relative(root, logoSvgPath)} のSVGからロゴ情報を読み取れません。`);
      }
      return {
        pathData,
        width: viewBox[2],
        height: viewBox[3]
      };
    });
  }
  return logoSvgCache;
}

function drawLogo(page, { logo, width, margin }) {
  const logoWidth = Math.min(190, width * 0.16);
  const scale = logoWidth / logo.width;
  const logoHeight = logo.height * scale;
  page.drawSvgPath(logo.pathData, {
    x: width - margin - logoWidth,
    y: margin * 0.55 + logoHeight,
    scale,
    color: rgb(0, 0, 0),
    opacity: 1
  });
}

function wrapText(text, font, fontSize, maxWidth, maxLines = Number.POSITIVE_INFINITY) {
  const characters = Array.from(String(text));
  const lines = [];
  let current = "";

  for (const character of characters) {
    const next = current + character;
    if (current && font.widthOfTextAtSize(next, fontSize) > maxWidth) {
      lines.push(current);
      current = character.trimStart();
      if (lines.length === maxLines - 1) break;
      continue;
    }
    current = next;
  }

  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function fitFontSize(text, font, desiredSize, maxWidth) {
  let size = desiredSize;
  while (size > 9 && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }
  return size;
}

async function runCommand(command, args, context) {
  try {
    await execFileAsync(command, args, { maxBuffer: 1024 * 1024 * 20 });
  } catch (error) {
    const stderr = error.stderr ? `\n${error.stderr}` : "";
    const stdout = error.stdout ? `\n${error.stdout}` : "";
    throw new Error(`${context}${stderr}${stdout}`);
  }
}

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  for (const entry of await visibleEntries(from)) {
    const source = path.join(from, entry);
    const target = path.join(to, entry);
    if (await isDirectory(source)) {
      await copyDir(source, target);
    } else {
      await fs.copyFile(source, target);
    }
  }
}

function latestLessonKeys(lessons, terms) {
  const latestByCourseLesson = new Map();
  for (const lesson of lessons) {
    const key = `${lesson.courseId}::${lesson.lessonNo}`;
    const startsAt = termStartsAt(terms, lesson.termId);
    const current = latestByCourseLesson.get(key);
    if (!current || startsAt > current.startsAt) {
      latestByCourseLesson.set(key, { startsAt, termId: lesson.termId, courseId: lesson.courseId, lessonNo: lesson.lessonNo });
    }
  }
  return new Set([...latestByCourseLesson.values()].map((lesson) => courseLessonKey(lesson.courseId, lesson.lessonNo, lesson.termId)));
}

function termStartsAt(terms, termId) {
  return terms.find((term) => term.id === termId)?.startsAt || "";
}

function courseLessonKey(courseId, lessonNo, termId) {
  return `${courseId}::${lessonNo}::${termId}`;
}

function lessonKey(termId, courseId, lessonNo) {
  return `${termId}::${courseId}::${normalizeLessonNo(lessonNo)}`;
}

function normalizeLessonNo(value) {
  const text = String(value).trim();
  return /^\d+$/.test(text) ? text.padStart(2, "0") : text;
}

function requireFields(object, fields, label) {
  for (const field of fields) {
    if (!object[field]) errors.push(`${label} に ${field} がありません。`);
  }
}

function validateDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) {
    errors.push(`${label} は YYYY-MM-DD 形式で指定してください: ${value}`);
  }
}

async function visibleEntries(dir) {
  return (await fs.readdir(dir)).filter((entry) => !entry.startsWith(".")).sort((a, b) => a.localeCompare(b, "ja"));
}

async function isDirectory(filePath) {
  return (await fs.stat(filePath)).isDirectory();
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function webPath(segments) {
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

function failIfErrors() {
  if (!errors.length) return;
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
