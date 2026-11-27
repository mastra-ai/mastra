import { isImageFile, useWorkspaceFileContent } from '@mastra/react/hooks/workspace';
import type { ComponentProps } from 'react';
import type { ExtraProps } from 'react-markdown';
import { resolveRelativePath } from '../path';
import { useWorkspaceContext } from './use-workspace-context';

export function WorkspaceMarkdownImage({ node: _node, src, alt, ...props }: ComponentProps<'img'> & ExtraProps) {
  const { activeFilePath } = useWorkspaceContext();
  const imagePath = activeFilePath && src ? resolveRelativePath(activeFilePath, src) : undefined;
  if (!imagePath || !isImageFile(imagePath)) return <img src={src} alt={alt} {...props} />;
  return <WorkspaceImage path={imagePath} alt={alt} {...props} />;
}

function WorkspaceImage({ path, alt, ...props }: ComponentProps<'img'> & { path: string }) {
  const { workspaceId } = useWorkspaceContext();
  const { data } = useWorkspaceFileContent({ workspaceId, path });
  if (!data?.content || !data.mimeType?.startsWith('image/')) return <span>{alt}</span>;
  return <img src={`data:${data.mimeType};base64,${data.content}`} alt={alt} {...props} />;
}
