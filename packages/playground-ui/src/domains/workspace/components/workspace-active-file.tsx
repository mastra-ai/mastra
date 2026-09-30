import type { ReactNode } from 'react';
import { isImageFile, isMarkdownFile, isVideoFile, videoMimeType } from '../file-type';
import { useWorkspaceFileContent } from '../hooks/use-workspace-file-content';
import { useWorkspaceContext } from './use-workspace-context';
import { WorkspaceError } from './workspace-error';
import { CodeBlock } from '@/ds/components/CodeBlock';
import { languageForPath } from '@/ds/components/CodeEditor/highlight';
import { EmptyState } from '@/ds/components/EmptyState';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';

export interface WorkspaceFilePreview {
  path: string;
  /** Base64 for images and videos, text otherwise. */
  content: string;
  mimeType?: string;
}

/** Return a node to take over the preview of a file, or `undefined` to keep the built-in rendering. */
export type WorkspacePreviewFactory = (file: WorkspaceFilePreview) => ReactNode | undefined;

export function WorkspaceFilePath() {
  const { activeFilePath } = useWorkspaceContext();
  if (!activeFilePath) return null;

  return (
    <Txt as="span" variant="body-sm" font="mono" tone="muted" className="truncate" data-testid="workspace-file-path">
      {activeFilePath}
    </Txt>
  );
}

function DefaultPreview({ path, content, mimeType }: WorkspaceFilePreview) {
  if (isImageFile(path, mimeType)) {
    return (
      <div className="flex justify-center p-4">
        <img
          src={`data:${mimeType || 'image/png'};base64,${content}`}
          alt={path.split('/').pop()}
          className="max-w-full object-contain"
        />
      </div>
    );
  }
  if (isVideoFile(path, mimeType)) {
    return (
      <div className="flex justify-center p-4">
        <video controls aria-label={path.split('/').pop()} className="max-w-full">
          <source
            src={`data:${videoMimeType(path, mimeType)};base64,${content}`}
            type={videoMimeType(path, mimeType)}
          />
        </video>
      </div>
    );
  }
  if (isMarkdownFile(path)) {
    return (
      <div className="p-4">
        <MarkdownRenderer>{content}</MarkdownRenderer>
      </div>
    );
  }
  return (
    <CodeBlock
      code={content}
      lang={languageForPath(path)}
      overflow="scroll"
      className="rounded-none border-0 bg-transparent [&_pre]:p-4"
    />
  );
}

export function WorkspaceActiveFileContent({ renderPreview }: { renderPreview?: WorkspacePreviewFactory }) {
  const { workspaceId, activeFilePath } = useWorkspaceContext();
  const { data, isLoading, error } = useWorkspaceFileContent(workspaceId, activeFilePath);

  if (!activeFilePath) return null;
  if (isLoading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2 p-4">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  // A failed background refetch keeps showing the last content.
  if (!data) return <WorkspaceError error={error} fallback="Could not load file." className="m-4" />;

  const file = { path: activeFilePath, content: data.content, mimeType: data.mimeType };
  return renderPreview?.(file) ?? <DefaultPreview {...file} />;
}
