import { Spinner } from '@mastra/playground-ui';
import { useEffect, useState } from 'react';
import { base64ToArrayBuffer } from './workspace-preview-binary-utils';
import { WorkspacePreviewFallback } from './workspace-preview-fallback';

interface PresentationSlide {
  number: number;
  text: string[];
}

interface PresentationPreviewState {
  error: Error | null;
  isLoading: boolean;
  slides: PresentationSlide[];
}

export interface WorkspacePresentationPreviewProps {
  content: string;
  isDownloading?: boolean;
  onDownload?: () => void;
  workspaceHref?: string;
}

function getSlideNumber(path: string) {
  return Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

function extractSlideText(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const parseError = document.getElementsByTagName('parsererror')[0];
  if (parseError) throw new Error('Failed to parse slide XML');

  const textNodes = Array.from(document.getElementsByTagName('a:t'));

  return textNodes.flatMap(node => {
    const text = node.textContent?.trim();

    return text ? [text] : [];
  });
}

function getTextHash(text: string) {
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }

  return hash.toString(36);
}

function getTextKey(text: string, occurrences: Map<string, number>) {
  const baseKey = getTextHash(text);
  const occurrence = occurrences.get(baseKey) ?? 0;
  occurrences.set(baseKey, occurrence + 1);

  return `${baseKey}:${occurrence}`;
}

export function WorkspacePresentationPreview({
  content,
  isDownloading,
  onDownload,
  workspaceHref,
}: WorkspacePresentationPreviewProps) {
  const [state, setState] = useState<PresentationPreviewState>({
    error: null,
    isLoading: true,
    slides: [],
  });

  useEffect(() => {
    let isCancelled = false;

    const loadPresentation = async () => {
      try {
        setState({ error: null, isLoading: true, slides: [] });

        const { default: JSZip } = await import('jszip');
        const zip = await JSZip.loadAsync(base64ToArrayBuffer(content));
        const slideFiles = zip
          .file(/^ppt\/slides\/slide\d+\.xml$/)
          .sort((left, right) => getSlideNumber(left.name) - getSlideNumber(right.name));
        const slides = await Promise.all(
          slideFiles.map(async file => ({
            number: getSlideNumber(file.name),
            text: extractSlideText(await file.async('text')),
          })),
        );

        if (!isCancelled) {
          setState({ error: null, isLoading: false, slides });
        }
      } catch (error) {
        if (!isCancelled) {
          setState({
            error: error instanceof Error ? error : new Error('Failed to parse presentation'),
            isLoading: false,
            slides: [],
          });
        }
      }
    };

    void loadPresentation();

    return () => {
      isCancelled = true;
    };
  }, [content]);

  if (state.isLoading) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (state.error) {
    return (
      <WorkspacePreviewFallback
        isDownloading={isDownloading}
        message={state.error.message}
        onDownload={onDownload}
        title="Failed to preview presentation"
        workspaceHref={workspaceHref}
      />
    );
  }

  if (state.slides.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center">
        <p className="text-sm font-medium text-neutral6">No slides to preview</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[280px] overflow-auto p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {state.slides.map(slide => {
          const textKeyOccurrences = new Map<string, number>();

          return (
            <section key={slide.number} className="border-b border-border1 pb-4 last:border-b-0">
              <h3 className="mb-3 text-xs font-medium uppercase text-neutral3">Slide {slide.number}</h3>
              {slide.text.length > 0 ? (
                <div className="space-y-2 text-sm leading-6 text-neutral5">
                  {slide.text.map(text => (
                    <p key={getTextKey(text, textKeyOccurrences)} className="whitespace-pre-wrap break-words">
                      {text}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral3">No readable text on this slide.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
