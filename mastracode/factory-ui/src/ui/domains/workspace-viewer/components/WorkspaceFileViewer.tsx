import { Button } from '@mastra/playground-ui/components/Button';
import { Code } from '@mastra/playground-ui/components/Code';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { WorkspaceFilePreview } from './workspace-file-preview';
import { IconArrowRotateClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateClockwise';

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** CSS counters, so copying the code never copies the numbers. */
const numberedLineClass =
  '[counter-increment:line] before:mr-4 before:inline-block before:text-right before:text-placeholder before:content-[counter(line)]';
/** Whole literal classes: Tailwind cannot see built ones. */
const numberedLineByDigits = [
  'before:w-[1ch]',
  'before:w-[2ch]',
  'before:w-[3ch]',
  'before:w-[4ch]',
  'before:w-[5ch]',
  'before:w-[6ch]',
  'before:w-[7ch]',
].map(width => () => `${numberedLineClass} ${width}`);

interface WorkspaceFileViewerProps {
  filePath: string;
  file?: WorkspaceFilePreview;
  isLoading: boolean;
  isRefreshing: boolean;
  error?: Error;
  onRefresh: () => void;
}

export function WorkspaceFileViewer({
  filePath,
  file,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
}: WorkspaceFileViewerProps) {
  const content = file?.content ?? '';
  const isMarkdown = file?.language === 'markdown';
  const nameStart = filePath.lastIndexOf('/') + 1;
  const numberedLine = numberedLineByDigits[String(content.split('\n').length).length - 1];

  return (
    <section className="flex min-h-0 min-w-0 grow flex-col" aria-label="Workspace file viewer">
      <div className="border-border flex min-h-10 shrink-0 items-center gap-0.5 border-b py-1 pr-1.5 pl-3">
        <h3 className="text-caption flex min-w-0 flex-1 items-baseline" title={filePath}>
          {nameStart > 0 ? (
            <span className="text-placeholder min-w-0 truncate">{filePath.slice(0, nameStart)}</span>
          ) : null}
          <span className="text-foreground max-w-full shrink-0 truncate font-medium">{filePath.slice(nameStart)}</span>
        </h3>
        {file ? (
          <Txt
            as="span"
            variant="caption"
            tone="faint"
            className="mx-1.5 shrink-0 tabular-nums"
            title={`Updated ${new Date(file.updatedAt).toLocaleString()}`}
          >
            {formatBytes(file.size)}
          </Txt>
        ) : null}
        {file?.contentType === 'text' ? (
          <CopyButton content={content} size="icon-sm" variant="ghost" tooltip="Copy file contents" />
        ) : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-label={isRefreshing ? 'Refreshing file' : 'Refresh file'}
              >
                {isRefreshing ? <Spinner size="sm" /> : <IconArrowRotateClockwise />}
              </Button>
            }
          />
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>

      {file?.truncated ? (
        <Txt as="p" variant="caption" tone="muted" className="border-border shrink-0 border-b px-3 py-2">
          Too large to show in full: this is the start of the file.
        </Txt>
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
          {file?.contentType === 'unsupported' ? (
            <Txt tone="muted" className="p-3">
              This file type cannot be previewed as text.
            </Txt>
          ) : null}
          {file?.contentType === 'text' && isMarkdown ? (
            <div className="p-3">
              <MarkdownRenderer>{content}</MarkdownRenderer>
            </div>
          ) : null}
          {file?.contentType === 'text' && !isMarkdown ? (
            <Code
              code={content}
              lang={file.language}
              lineClassName={numberedLine}
              className="text-caption text-foreground m-0 p-3 font-mono [counter-reset:line]"
            />
          ) : null}
        </ScrollArea>
      ) : null}
    </section>
  );
}
