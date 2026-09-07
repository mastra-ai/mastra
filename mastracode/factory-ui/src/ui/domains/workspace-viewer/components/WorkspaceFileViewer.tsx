import { Button } from '@mastra/playground-ui/components/Button';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowLeft, RefreshCw } from 'lucide-react';

import type { WorkspaceFilePreview } from './workspace-file-preview';

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

interface WorkspaceFileViewerProps {
  filePath: string;
  file?: WorkspaceFilePreview;
  isLoading: boolean;
  isRefreshing: boolean;
  error?: Error;
  onRefresh: () => void;
  onBack: () => void;
}

export function WorkspaceFileViewer({
  filePath,
  file,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  onBack,
}: WorkspaceFileViewerProps) {
  const content = file?.content ?? '';
  const isMarkdown = file?.language === 'markdown';

  return (
    <section className="flex min-h-0 min-w-0 grow flex-col" aria-label="Workspace file viewer">
      <div className="border-border1 flex shrink-0 items-center gap-2 border-b p-1.5">
        <Button
          size="icon-sm"
          variant="ghost"
          className="shrink-0"
          onClick={onBack}
          aria-label="Back to workspace files"
        >
          <ArrowLeft />
        </Button>
        <Txt variant="ui-sm" className="text-icon6 min-w-0 flex-1 truncate font-medium">
          {file?.name ?? filePath}
        </Txt>
        <div className="flex shrink-0 items-center gap-1">
          {file?.contentType === 'text' ? (
            <CopyButton content={content} size="icon-xs" variant="ghost" tooltip="Copy file contents" />
          ) : null}
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={isRefreshing ? 'Refreshing file' : 'Refresh file'}
          >
            {isRefreshing ? <Spinner size="sm" /> : <RefreshCw />}
          </Button>
        </div>
      </div>

      {file ? (
        <div className="border-border1 text-icon3 flex shrink-0 items-center gap-3 border-b px-3 py-2 text-xs">
          <span className="min-w-0 truncate">{file.path}</span>
          <span className="ml-auto shrink-0">{formatBytes(file.size)}</span>
          <span className="shrink-0">{new Date(file.updatedAt).toLocaleString()}</span>
          {file.truncated ? <span className="shrink-0">Truncated</span> : null}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Spinner size="sm" />
        </div>
      ) : null}
      {error ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center">
          <Txt variant="ui-sm" className="text-error">
            {error.message}
          </Txt>
        </div>
      ) : null}
      {!isLoading && !error ? (
        <ScrollArea className="min-h-0 flex-1" orientation="both">
          <div className="p-3">
            {file?.contentType === 'unsupported' ? (
              <Txt className="text-icon3">This file type cannot be previewed as text.</Txt>
            ) : null}
            {file?.contentType === 'text' && isMarkdown ? <MarkdownRenderer>{content}</MarkdownRenderer> : null}
            {file?.contentType === 'text' && !isMarkdown ? (
              <pre className="border-border1 bg-surface2 text-icon6 m-0 rounded-md border p-3 font-mono text-xs leading-relaxed">
                <code dangerouslySetInnerHTML={{ __html: file.highlightedContent ?? '' }} />
              </pre>
            ) : null}
          </div>
        </ScrollArea>
      ) : null}
    </section>
  );
}
