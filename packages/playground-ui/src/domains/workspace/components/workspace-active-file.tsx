import {
  isImageFile,
  isMarkdownFile,
  isVideoFile,
  videoMimeType,
  useWorkspaceFileContent,
} from '@mastra/react/hooks/workspace';
import type { ReactNode } from 'react';
import { useWorkspaceContext } from './use-workspace-context';
import { WorkspaceCode } from './workspace-code';
import { WorkspaceError } from './workspace-error';
import { WorkspaceFileSkeleton } from './workspace-file-skeleton';
import { WorkspaceJsonPreview } from './workspace-json-preview';
import { WorkspaceMarkdownImage } from './workspace-markdown-image';
import { WorkspaceMarkdownPreview } from './workspace-markdown-preview';
import { languageForPath } from '@/ds/components/CodeEditor/highlight';
import { EmptyState } from '@/ds/components/EmptyState';
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

const isBinary = (content: string) => content.slice(0, 8000).includes('\0');

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
  if (isBinary(content)) {
    return (
      <EmptyState titleSlot="No preview available" descriptionSlot="This file isn’t text, so it can’t be shown here." />
    );
  }
  if (isMarkdownFile(path)) {
    return <WorkspaceMarkdownPreview content={content} image={WorkspaceMarkdownImage} />;
  }
  const lang = languageForPath(path);
  if (lang === 'json') return <WorkspaceJsonPreview key={path} path={path} content={content} />;
  return <WorkspaceCode path={path} code={content} lang={lang} />;
}

export function WorkspaceActiveFileContent({ renderPreview }: { renderPreview?: WorkspacePreviewFactory }) {
  const { workspaceId, activeFilePath } = useWorkspaceContext();
  const { data, isLoading, error } = useWorkspaceFileContent({
    workspaceId: workspaceId,
    path: activeFilePath,
    queryOptions: { enabled: !!activeFilePath },
  });

  if (!activeFilePath) return null;
  if (isLoading) return <WorkspaceFileSkeleton />;
  // A failed background refetch keeps showing the last content.
  if (!data) return <WorkspaceError error={error ?? undefined} fallback="Could not load file." className="m-4" />;

  const file = { path: activeFilePath, content: data.content, mimeType: data.mimeType };
  return renderPreview?.(file) ?? <DefaultPreview {...file} />;
}
