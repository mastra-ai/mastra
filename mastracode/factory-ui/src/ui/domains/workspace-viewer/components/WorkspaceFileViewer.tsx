import { Button } from '@mastra/playground-ui/components/Button';
import { Code } from '@mastra/playground-ui/components/Code';
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
      <div className="border-border flex shrink-0 items-center gap-2 border-b p-1.5">
        <Button
          size="icon-sm"
          variant="ghost"
          className="shrink-0"
          onClick={onBack}
          aria-label="Back to workspace files"
        >
          <ArrowLeft />
        </Button>
        <Txt tone="ink" variant="column" className="min-w-0 flex-1 truncate">
          {file?.name ?? filePath}
        </Txt>
        <div className="flex shrink-0 items-center gap-1">
          {file?.contentType === 'text' ? (
            <CopyButton content={content} size="icon-sm" variant="ghost" tooltip="Copy file contents" />
          ) : null}
          <Button
            size="icon-sm"
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
        <div className="border-border flex shrink-0 items-center gap-3 border-b px-3 py-2">
          <Txt tone="muted" as="span" variant="caption" className="min-w-0 truncate">
            {file.path}
          </Txt>
          <Txt tone="muted" as="span" variant="caption" className="ml-auto shrink-0">
            {formatBytes(file.size)}
          </Txt>
          <Txt tone="muted" as="span" variant="caption" className="shrink-0">
            {new Date(file.updatedAt).toLocaleString()}
          </Txt>
          {file.truncated ? (
            <Txt tone="muted" as="span" variant="caption" className="shrink-0">
              Truncated
            </Txt>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Spinner size="sm" />
        </div>
      ) : null}
      {error ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center">
          <Txt variant="caption" className="text-destructive-foreground">
            {error.message}
          </Txt>
        </div>
      ) : null}
      {!isLoading && !error ? (
        <ScrollArea className="min-h-0 flex-1" orientation="both">
          <div className="p-3">
            {file?.contentType === 'unsupported' ? (
              <Txt tone="muted">This file type cannot be previewed as text.</Txt>
            ) : null}
            {file?.contentType === 'text' && isMarkdown ? <MarkdownRenderer>{content}</MarkdownRenderer> : null}
            {file?.contentType === 'text' && !isMarkdown ? (
              <Code
                code={content}
                lang={file.language}
                className="border-border bg-background m-0 rounded-md border p-3 text-caption font-mono text-foreground"
              />
            ) : null}
          </div>
        </ScrollArea>
      ) : null}
    </section>
  );
}
