import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

type Destination = string | unknown[];
type PageViewport = ReturnType<PDFPageProxy["getViewport"]>;

function safeHref(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const url = URL.parse(value);
  if (url && ["http:", "https:", "mailto:"].includes(url.protocol)) return url.href;
}

async function destinationPage(pdf: PDFDocumentProxy, destination: Destination) {
  const resolved = typeof destination === "string" ? await pdf.getDestination(destination) : destination;
  const ref: unknown = resolved?.[0];
  if (typeof ref === "number" && Number.isInteger(ref)) return ref + 1;
  if (typeof ref === "object" && ref !== null && "num" in ref && "gen" in ref
      && typeof ref.num === "number" && typeof ref.gen === "number") {
    return (await pdf.getPageIndex({ num: ref.num, gen: ref.gen })) + 1;
  }
}

export function findPdfTextLinks(items: Awaited<ReturnType<PDFPageProxy["getTextContent"]>>["items"]) {
  return items.flatMap((item) => {
    if (!("str" in item) || item.dir !== "ltr") return [];

    const { str, transform: [a, b, c, d, x, y], width, height } = item;
    const baseline = Math.hypot(a, b);
    const vertical = Math.hypot(c, d);
    if (!baseline || !vertical || width <= 0 || height <= 0) return [];

    return Array.from(str.matchAll(/https?:\/\/[^\s<>"「」『』、。]+/gi), (match) => {
      const url = match[0].replace(/[.,;!?\])}]+$/, "");
      const start = width * match.index / str.length;
      const end = width * (match.index + url.length) / str.length;
      const point = (along: number, rise: number) => [
        x + along * a / baseline + rise * c / vertical,
        y + along * b / baseline + rise * d / vertical,
      ];
      const corners = [point(start, -height * 0.2), point(end, -height * 0.2), point(start, height), point(end, height)];
      const xs = corners.map(([px]) => px);
      const ys = corners.map(([, py]) => py);

      return { subtype: "Link", url, rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
    });
  });
}

export function appendPdfPageLinks(
  surface: HTMLDivElement,
  annotations: unknown[],
  viewport: PageViewport,
  pdf: PDFDocumentProxy,
  onNavigate: (page: number) => void,
) {
  const occupied: { href: string; left: number; top: number; width: number; height: number }[] = [];
  for (const annotation of annotations) {
    if (typeof annotation !== "object" || annotation === null || !("subtype" in annotation) || annotation.subtype !== "Link") continue;
    if (!("rect" in annotation) || !Array.isArray(annotation.rect) || annotation.rect.length !== 4
        || !annotation.rect.every((coordinate: unknown) => typeof coordinate === "number" && Number.isFinite(coordinate))) continue;

    const href = "url" in annotation ? safeHref(annotation.url) : undefined;
    const destination = "dest" in annotation ? annotation.dest : undefined;
    let control: HTMLAnchorElement;

    if (href) {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.setAttribute("aria-label", `リンクを開く: ${href}`);
      control = anchor;
    } else if (typeof destination === "string" || (Array.isArray(destination) && destination.length > 0)) {
      const target: Destination = destination;
      const link = document.createElement("a");
      link.setAttribute("role", "link");
      link.tabIndex = 0;
      link.setAttribute("aria-label", "PDF 内のリンクを開く");
      async function navigate() {
        const page = await destinationPage(pdf, target).catch(() => undefined);
        if (link.isConnected && page !== undefined && page >= 1 && page <= pdf.numPages) onNavigate(page);
      }
      link.addEventListener("click", () => void navigate());
      link.addEventListener("keydown", (event) => {
        if (event.key === "Enter") void navigate();
      });
      control = link;
    } else {
      continue;
    }

    const [x1, y1] = viewport.convertToViewportPoint(annotation.rect[0], annotation.rect[1]);
    const [x2, y2] = viewport.convertToViewportPoint(annotation.rect[2], annotation.rect[3]);
    const left = Math.max(0, Math.min(x1, x2));
    const top = Math.max(0, Math.min(y1, y2));
    const width = Math.min(viewport.width, Math.max(x1, x2)) - left;
    const height = Math.min(viewport.height, Math.max(y1, y2)) - top;
    if (width <= 0 || height <= 0) continue;

    if (href) {
      if (occupied.some((box) => box.href === href && box.left < left + width && left < box.left + box.width
          && box.top < top + height && top < box.top + box.height)) continue;
      occupied.push({ href, left, top, width, height });
    }

    control.className = "absolute z-10 cursor-pointer rounded-sm hover:bg-blue-500/15 focus-visible:outline-2 focus-visible:outline-blue-700";
    Object.assign(control.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    surface.append(control);
  }
}
