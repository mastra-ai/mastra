import type { ReactNode } from 'react';
import { IconFileBend } from '@mastra/playground-ui/icons/central/IconFileBend';
import { IconFileText } from '@mastra/playground-ui/icons/central/IconFileText';
import { IconFolder1 } from '@mastra/playground-ui/icons/central/IconFolder1';
import { IconFolderOpen } from '@mastra/playground-ui/icons/central/IconFolderOpen';
import { IconImages1 } from '@mastra/playground-ui/icons/central/IconImages1';
import { IconJson } from '@mastra/playground-ui/icons/central/IconJson';
import { IconScript } from '@mastra/playground-ui/icons/central/IconScript';

export function getFileIcon(path: string): ReactNode {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <IconScript className="text-badge-blue-indicator" />;
    case 'json':
      return <IconJson className="text-badge-amber-indicator" />;
    case 'md':
    case 'mdx':
      return <IconFileText className="text-muted-foreground" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <IconImages1 className="text-muted-foreground" />;
    default:
      return <IconFileBend className="text-muted-foreground" />;
  }
}

export function getFolderIcon(isOpen: boolean): ReactNode {
  return isOpen ? (
    <IconFolderOpen className="text-badge-amber-indicator" />
  ) : (
    <IconFolder1 className="text-badge-amber-indicator" />
  );
}
