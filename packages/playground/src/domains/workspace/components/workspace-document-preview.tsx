import { Spinner } from '@mastra/playground-ui';
import { useEffect, useState } from 'react';
import { base64ToArrayBuffer } from './workspace-preview-binary-utils';
import { WorkspacePreviewFallback } from './workspace-preview-fallback';

interface DocumentPreviewState {
  error: Error | null;
  isLoading: boolean;
  text: string;
  warningCount: number;
}

export interface WorkspaceDocumentPreviewProps {
  content: string;
  isDownloading?: boolean;
  onDownload?: () => void;
  workspaceHref?: string;
}

function splitParagraphs(text: string) {
  return text.split(/\n{2,}|\r?\n/).flatMap(paragraph => {
    const trimmedParagraph = paragraph.trim();

    return trimmedParagraph ? [trimmedParagraph] : [];
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

function getKeyedParagraphs(paragraphs: string[]) {
  const occurrences = new Map<string, number>();

  return paragraphs.map(paragraph => {
    const baseKey = getTextHash(paragraph);
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);

    return {
      key: `${baseKey}:${occurrence}`,
      text: paragraph,
    };
  });
}

export function WorkspaceDocumentPreview({
  content,
  isDownloading,
  onDownload,
  workspaceHref,
}: WorkspaceDocumentPreviewProps) {
  const [state, setState] = useState<DocumentPreviewState>({
    error: null,
    isLoading: true,
    text: '',
    warningCount: 0,
  });

  useEffect(() => {
    let isCancelled = false;

    const loadDocument = async () => {
      try {
        setState({ error: null, isLoading: true, text: '', warningCount: 0 });

        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer: base64ToArrayBuffer(content) });

        if (!isCancelled) {
          setState({
            error: null,
            isLoading: false,
            text: result.value,
            warningCount: result.messages.length,
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setState({
            error: error instanceof Error ? error : new Error('Failed to parse document'),
            isLoading: false,
            text: '',
            warningCount: 0,
          });
        }
      }
    };

    void loadDocument();

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
        title="Failed to preview document"
        workspaceHref={workspaceHref}
      />
    );
  }

  const paragraphs = getKeyedParagraphs(splitParagraphs(state.text));

  return (
    <div className="h-full min-h-[280px] overflow-auto px-5 py-4">
      {state.warningCount > 0 ? (
        <p className="mb-4 text-xs text-neutral3">
          Preview extracted readable text with {state.warningCount} warning{state.warningCount === 1 ? '' : 's'}.
        </p>
      ) : null}
      {paragraphs.length > 0 ? (
        <div className="mx-auto max-w-3xl space-y-3 text-sm leading-6 text-neutral5">
          {paragraphs.map(paragraph => (
            <p key={paragraph.key} className="whitespace-pre-wrap break-words">
              {paragraph.text}
            </p>
          ))}
        </div>
      ) : (
        <div className="flex h-full min-h-[240px] items-center justify-center text-center">
          <p className="text-sm font-medium text-neutral6">No readable text found</p>
        </div>
      )}
    </div>
  );
}
