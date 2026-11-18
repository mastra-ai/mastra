import { Button } from '@mastra/playground-ui/components/Button';
import { Code } from '@mastra/playground-ui/components/Code';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { CSSProperties } from 'react';

import type { WorkspaceFilePreview } from './workspace-file-preview';
import { IconArrowRotateClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateClockwise';

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const fileDetailsClass = 'border-border flex shrink-0 items-center gap-3 border-b px-3 py-2';
const fileCodeClass = 'border-border bg-background text-caption text-foreground m-0 rounded-md border p-3 font-mono';

const SKELETON_LINES = ['w-1/3', 'w-2/3', 'w-1/2', 'w-3/4', 'w-2/5', 'w-5/6', 'w-1/2', 'w-3/5', 'w-1/4', 'w-2/3'];

function WorkspaceFileViewerSkeleton() {
  return (
    <>
      <div aria-hidden className={fileDetailsClass}>
        <SkeletonText line="text-caption" className="h-3 w-40 max-w-full motion-reduce:before:animate-none" />
        <span className="ml-auto flex items-center gap-3">
          <SkeletonText line="text-caption" className="h-3 w-10 max-w-full motion-reduce:before:animate-none" />
          <SkeletonText line="text-caption" className="h-3 w-28 max-w-full motion-reduce:before:animate-none" />
        </span>
      </div>
      <div role="status" aria-label="Loading file" className="min-h-0 flex-1 overflow-hidden p-3">
        <div aria-hidden className={cn(fileCodeClass, 'flex flex-col')}>
          {SKELETON_LINES.map((width, line) => (
            <SkeletonText
              key={line}
              line="text-caption"
              className={cn('h-3 max-w-full motion-reduce:before:animate-none', width)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/** CSS counters, so copying the code never copies the numbers. */
const numberedLineClass =
  '[counter-increment:line] before:mr-4 before:inline-block before:w-[calc(var(--line-digits)*1ch)] before:text-right before:text-placeholder before:content-[counter(line)]';
const numberedLine = () => numberedLineClass;

type GutterStyle = CSSProperties & { '--line-digits': number };

function lineCount(text: string): number {
  let count = 1;
  for (let at = text.indexOf('\n'); at !== -1; at = text.indexOf('\n', at + 1)) count++;
  return count;
}

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
  const gutter: GutterStyle = { '--line-digits': String(lineCount(content)).length };

  return (
    <section className="flex min-h-0 min-w-0 grow flex-col" aria-label="Workspace file viewer">
      <div className="border-border flex shrink-0 items-center gap-2 border-b p-1.5">
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
            {isRefreshing ? <Spinner size="sm" /> : <IconArrowRotateClockwise />}
          </Button>
        </div>
      </div>

      {file ? (
        <div className={fileDetailsClass}>
          <Txt tone="muted" as="span" variant="caption" className="min-w-0 truncate">
            {file.path}
          </Txt>
          <Txt tone="muted" as="span" variant="caption" className="ml-auto shrink-0">
            {formatBytes(file.size)}
          </Txt>
          <Txt tone="muted" as="span" variant="caption" className="shrink-0">
            {new Date(file.updatedAt).toLocaleString()}
          </Txt>
        </div>
      ) : null}

      {file?.truncated ? (
        <Txt as="p" variant="caption" tone="muted" className="border-border shrink-0 border-b px-3 py-2">
          Too large to show in full: this is the start of the file.
        </Txt>
      ) : null}

      {isLoading ? <WorkspaceFileViewerSkeleton /> : null}
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
                lineClassName={numberedLine}
                style={gutter}
                className={cn(fileCodeClass, '[counter-reset:line]')}
              />
            ) : null}
          </div>
        </ScrollArea>
      ) : null}
    </section>
  );
}
