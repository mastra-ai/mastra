import { Button, Spinner } from '@mastra/playground-ui';
import { AlertCircle, RotateCcw } from 'lucide-react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?worker&url';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

interface WorkspacePdfPreviewProps {
  content: string;
  fileName: string;
}

interface WorkspacePdfPageProps {
  containerWidth: number;
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
}

interface PdfPreviewState {
  error: Error | null;
  isLoading: boolean;
  pdfDocument: PDFDocumentProxy | null;
  retryKey: number;
}

type PdfPreviewAction =
  | { type: 'failed'; error: Error }
  | { type: 'loaded'; pdfDocument: PDFDocumentProxy }
  | { type: 'loading' }
  | { type: 'retry' };

const initialPdfPreviewState: PdfPreviewState = {
  error: null,
  isLoading: true,
  pdfDocument: null,
  retryKey: 0,
};

function pdfPreviewReducer(state: PdfPreviewState, action: PdfPreviewAction): PdfPreviewState {
  switch (action.type) {
    case 'failed':
      return { ...state, error: action.error, isLoading: false, pdfDocument: null };
    case 'loaded':
      return { ...state, error: null, isLoading: false, pdfDocument: action.pdfDocument };
    case 'loading':
      return { ...state, error: null, isLoading: true, pdfDocument: null };
    case 'retry':
      return { ...state, retryKey: state.retryKey + 1 };
  }
}

function base64ToBytes(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function WorkspacePdfPage({ containerWidth, pdfDocument, pageNumber }: WorkspacePdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    if (!containerWidth) return;

    let isCancelled = false;
    let renderTask: RenderTask | null = null;

    const renderPage = async () => {
      setIsRendering(true);

      const page = await pdfDocument.getPage(pageNumber);
      if (isCancelled) return;

      const unscaledViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(containerWidth - 32, 240);
      const scale = Math.min(Math.max(availableWidth / unscaledViewport.width, 0.5), 2.5);
      const viewport = page.getViewport({ scale });
      const pixelRatio = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');

      if (!canvas || !context) return;

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      renderTask = page.render({ canvas, canvasContext: context, viewport });
      await renderTask.promise;

      if (!isCancelled) setIsRendering(false);
    };

    renderPage().catch(error => {
      if (!isCancelled && error instanceof Error && error.name !== 'RenderingCancelledException') {
        setIsRendering(false);
      }
    });

    return () => {
      isCancelled = true;
      renderTask?.cancel();
    };
  }, [containerWidth, pdfDocument, pageNumber]);

  return (
    <div className="relative flex justify-center">
      {isRendering ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        aria-label={`Page ${pageNumber}`}
        className="block max-w-full bg-white shadow-sm"
        data-testid={`workspace-pdf-page-${pageNumber}`}
      />
    </div>
  );
}

export function WorkspacePdfPreview({ content, fileName }: WorkspacePdfPreviewProps) {
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [{ error, isLoading, pdfDocument, retryKey }, dispatch] = useReducer(
    pdfPreviewReducer,
    initialPdfPreviewState,
  );

  const setPdfContainerRef = useCallback((element: HTMLDivElement | null) => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;

    if (!element) return;

    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });

    setContainerWidth(element.getBoundingClientRect().width || 0);
    observer.observe(element);
    resizeObserverRef.current = observer;
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    const loadDocument = async () => {
      try {
        dispatch({ type: 'loading' });

        const pdfjs = await import('pdfjs-dist');

        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
        loadingTask = pdfjs.getDocument({ data: base64ToBytes(content) });
        const loadedDocument = await loadingTask.promise;

        if (isCancelled) {
          await loadedDocument.cleanup();
          return;
        }

        dispatch({ type: 'loaded', pdfDocument: loadedDocument });
      } catch (error) {
        if (!isCancelled) {
          dispatch({ type: 'failed', error: error instanceof Error ? error : new Error('Failed to load PDF') });
        }
      }
    };

    void loadDocument();

    return () => {
      isCancelled = true;
      void loadingTask?.destroy();
    };
  }, [content, retryKey]);

  useEffect(() => {
    return () => {
      void pdfDocument?.cleanup();
    };
  }, [pdfDocument]);

  if (error) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center">
        <div>
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-400" />
          <p className="mb-1 text-sm font-medium text-neutral6">Failed to render PDF</p>
          <p className="text-xs text-neutral4">{error.message}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => dispatch({ type: 'retry' })}
          >
            <RotateCcw />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={setPdfContainerRef} className="h-full min-h-[280px] w-full px-4 py-4" aria-label={fileName}>
      {isLoading || !pdfDocument ? (
        <div className="flex h-full min-h-[280px] items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-full flex-col items-center gap-4">
          {Array.from({ length: pdfDocument.numPages }, (_, index) => (
            <WorkspacePdfPage
              key={index + 1}
              containerWidth={containerWidth}
              pdfDocument={pdfDocument}
              pageNumber={index + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
