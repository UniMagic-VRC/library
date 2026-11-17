import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState, type PointerEvent } from "react";

const thumbnailWidth = 112;
const thumbnailHeight = 64;
const thumbRadius = 8;

function PdfThumbnail({ pdf, pageNumber }: { pdf: PDFDocumentProxy; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let active = true;
    let task: RenderTask | undefined;

    async function renderThumbnail(target: HTMLCanvasElement) {
      const page = await pdf.getPage(pageNumber);
      if (!active) return;

      const natural = page.getViewport({ scale: 1 });
      const scale = Math.min(thumbnailWidth / natural.width, thumbnailHeight / natural.height);
      const viewport = page.getViewport({ scale });
      target.width = Math.max(1, Math.ceil(viewport.width));
      target.height = Math.max(1, Math.ceil(viewport.height));
      task = page.render({ canvas: target, viewport });
      await task.promise;
      if (active) target.hidden = false;
    }

    void renderThumbnail(canvas).catch(() => {
      // The page number remains visible if its preview cannot render.
    });

    return () => {
      active = false;
      task?.cancel();
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [pdf, pageNumber]);

  return <canvas ref={canvasRef} hidden />;
}

export function PdfSeekBar({ pdf, pageNumber, onSelect }: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  onSelect: (pageNumber: number) => void;
}) {
  const [pointerPage, setPointerPage] = useState<number | null>(null);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const pageCount = pdf.numPages;
  const progress = pageCount > 1 ? ((pageNumber - 1) / (pageCount - 1)) * 100 : 100;
  const previewPage = pointerPage ?? (keyboardFocused ? pageNumber : null);
  const previewPosition = previewPage === null || pageCount < 2 ? 0.5 : (previewPage - 1) / (pageCount - 1);

  function previewAtPointer(event: PointerEvent<HTMLInputElement>) {
    if (event.pointerType === "touch" && !event.buttons && event.type === "pointermove") return;

    const { left, width } = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - left - thumbRadius) / Math.max(1, width - 2 * thumbRadius);
    const offset = Math.round(Math.max(0, Math.min(1, fraction)) * (pageCount - 1));
    setKeyboardFocused(false);
    setPointerPage(1 + offset);
  }

  function finishPointer(event: PointerEvent<HTMLInputElement>) {
    if (event.pointerType !== "mouse") setPointerPage(null);
  }

  return (
    <div className="min-w-0">
      <div className="relative">
        {previewPage !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full z-10 mb-1 w-[124px] -translate-x-1/2 rounded-md border border-line bg-surface p-1 text-center text-xs font-bold tabular-nums text-ink shadow-md"
            style={{ left: `clamp(62px, calc(${previewPosition * 100}% + ${thumbRadius * (1 - 2 * previewPosition)}px), 100% - 62px)` }}
          >
            <div className="flex h-16 items-center justify-center overflow-hidden rounded-sm bg-surface-strong">
              <PdfThumbnail key={previewPage} pdf={pdf} pageNumber={previewPage} />
            </div>
            <div className="mt-1">{previewPage} / {pageCount}</div>
          </div>
        )}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-line/90">
          <div className="h-full bg-accent-strong" style={{ width: `${progress}%` }} />
        </div>
        <input
          type="range"
          aria-label="ページを選択"
          aria-valuetext={`${pageNumber} / ${pageCount} ページ`}
          min={1}
          max={pageCount}
          step={1}
          value={pageNumber}
          disabled={pageCount < 2}
          onChange={(event) => onSelect(event.currentTarget.valueAsNumber)}
          onPointerDown={previewAtPointer}
          onPointerMove={previewAtPointer}
          onPointerUp={finishPointer}
          onPointerCancel={() => setPointerPage(null)}
          onPointerLeave={() => setPointerPage(null)}
          onFocus={(event) => setKeyboardFocused(event.currentTarget.matches(":focus-visible"))}
          onKeyDown={() => {
            setPointerPage(null);
            setKeyboardFocused(true);
          }}
          onBlur={() => setKeyboardFocused(false)}
          className="relative block h-6 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-default [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-transparent [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent [&::-moz-range-track]:bg-transparent"
        />
      </div>
    </div>
  );
}
