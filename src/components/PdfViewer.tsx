/// <reference types="vite/client" />

import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { PdfSeekBar } from "./PdfSeekBar";
import { appendPdfPageLinks, findPdfTextLinks } from "./PdfPageLinks";

const buttonClass = "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-accent-strong disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent";

type PdfState = { status: "loading" | "error" } | { status: "ready"; document: PDFDocumentProxy };

export function PdfViewer({ src, title, initialPage = 1, onPageChange }: {
  src: string;
  title: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PdfState>({ status: "loading" });
  const [renderStatus, setRenderStatus] = useState<"loading" | "ready" | "error">("loading");
  const [availableWidth, setAvailableWidth] = useState(0);
  const [selectedPage, setPageNumber] = useState(initialPage);
  const pageCount = pdf.status === "ready" ? pdf.document.numPages : 0;
  const pageNumber = Number.isSafeInteger(selectedPage) && selectedPage >= 1 && selectedPage <= pageCount ? selectedPage : 1;

  useEffect(() => {
    if (pageCount > 0) onPageChange?.(pageNumber);
  }, [onPageChange, pageCount, pageNumber]);

  useEffect(() => {
    let active = true;
    let loadingTask: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;

    async function loadPdf() {
      const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
      if (!active) return;

      GlobalWorkerOptions.workerSrc = workerUrl;
      loadingTask = getDocument({ url: src });
      const document = await loadingTask.promise;
      if (active) setPdf({ status: "ready", document });
    }

    void loadPdf().catch(() => {
      if (active) setPdf({ status: "error" });
    });

    return () => {
      active = false;
      void loadingTask?.destroy().catch((error: unknown) => {
        console.error("Could not release the PDF document", error);
      });
    };
  }, [src]);

  useEffect(() => {
    const scrollViewport = viewportRef.current;
    if (!scrollViewport) return;

    const observer = new ResizeObserver(() => setAvailableWidth(scrollViewport.clientWidth));
    observer.observe(scrollViewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvasHost = canvasHostRef.current;
    if (pdf.status !== "ready" || !canvasHost || availableWidth === 0) return;

    let active = true;
    let renderTask: RenderTask | undefined;
    const canvas = document.createElement("canvas");
    const surface = document.createElement("div");
    surface.className = "relative shrink-0";
    surface.append(canvas);
    async function renderPage(pdfDocument: PDFDocumentProxy, host: HTMLDivElement) {
      const page = await pdfDocument.getPage(pageNumber);
      if (!active) return;

      const naturalWidth = page.getViewport({ scale: 1 }).width;
      const pageViewport = page.getViewport({ scale: availableWidth / naturalWidth });
      // Bound the backing canvas on high-density screens.
      const pixelRatio = Math.min(window.devicePixelRatio, 2, Math.sqrt(16_000_000 / (pageViewport.width * pageViewport.height)));
      canvas.width = Math.max(1, Math.floor(pageViewport.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(pageViewport.height * pixelRatio));
      canvas.style.width = `${pageViewport.width}px`;
      canvas.style.height = `${pageViewport.height}px`;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `${title}の${pageNumber}ページ目`);
      canvas.className = "block shrink-0 cursor-pointer bg-white";

      renderTask = page.render({
        canvas,
        viewport: pageViewport,
        transform: [canvas.width / pageViewport.width, 0, 0, canvas.height / pageViewport.height, 0, 0],
      });
      const [annotations, textLinks] = await Promise.all([
        page.getAnnotations({ intent: "display" }).catch(() => []),
        page.getTextContent().then(({ items }) => findPdfTextLinks(items)).catch(() => []),
        renderTask.promise,
      ]);
      if (active) {
        appendPdfPageLinks(surface, [...annotations, ...textLinks], pageViewport, pdfDocument, setPageNumber);
        const previous = host.querySelector("canvas");
        host.replaceChildren(surface);
        if (previous instanceof HTMLCanvasElement) {
          previous.width = 0;
          previous.height = 0;
        }
        setRenderStatus("ready");
      }
    }

    void renderPage(pdf.document, canvasHost).catch(() => {
      if (active) setRenderStatus("error");
    });

    return () => {
      active = false;
      renderTask?.cancel();
      if (!surface.parentNode) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, [availableWidth, pageNumber, pdf, title]);

  const hasError = pdf.status === "error" || renderStatus === "error";
  const loading = !hasError && (pdf.status === "loading" || renderStatus === "loading");

  function movePage(offset: number) {
    if (pageCount > 0) {
      setPageNumber((current) => {
        const page = Number.isSafeInteger(current) && current >= 1 && current <= pageCount ? current : 1;
        return Math.max(1, Math.min(pageCount, page + offset));
      });
    }
  }

  function handlePageClick(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLCanvasElement)) return;

    const { left, width } = event.target.getBoundingClientRect();
    movePage(event.clientX < left + width / 2 ? -1 : 1);
  }

  return (
    <section aria-label={`${title}の PDF ビューア`} className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-2 py-1">
        <div role="group" aria-label="ページ移動" className="flex items-center gap-1">
          <button type="button" aria-label="前のページ" className={buttonClass} disabled={pageNumber <= 1} onClick={() => movePage(-1)}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span aria-live="polite" aria-atomic="true" className="min-w-12 whitespace-nowrap text-center text-sm tabular-nums">
            {pageCount > 0 ? `${pageNumber} / ${pageCount}` : "– / –"}
          </span>
          <button type="button" aria-label="次のページ" className={buttonClass} disabled={pageNumber >= pageCount} onClick={() => movePage(1)}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        <a href={src} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-md px-2 text-sm font-bold text-accent-strong hover:bg-surface-strong">
          PDF を開く <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>
      <div className="group/pdf relative bg-surface-strong">
        <div ref={viewportRef} tabIndex={0} role="region" aria-label="PDF ページ表示" className="overflow-x-auto focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent-strong">
          {loading && <p role="status" className="m-0 px-4 py-8 text-center text-sm text-muted">PDF を読み込んでいます。</p>}
          {hasError && <p role="alert" className="m-0 px-4 py-8 text-center text-sm text-warning">PDF を表示できませんでした。</p>}
          <div ref={canvasHostRef} className="flex w-max min-w-full justify-center" onClick={handlePageClick} />
        </div>
        {pdf.status === "ready" && (
          <div className="absolute inset-x-0 bottom-0 transition-opacity [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/pdf:pointer-events-auto [@media(hover:hover)]:group-hover/pdf:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:opacity-100">
            <PdfSeekBar pdf={pdf.document} pageNumber={pageNumber} onSelect={setPageNumber} />
          </div>
        )}
      </div>
    </section>
  );
}
