import { File, FileCode, FileJson, FileText, Folder, FolderOpen, Image } from 'lucide-react';
import type { ReactNode } from 'react';

export function getFileIcon(path: string): ReactNode {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode className="text-badge-blue-indicator" />;
    case 'json':
      return <FileJson className="text-badge-amber-indicator" />;
    case 'md':
    case 'mdx':
      return <FileText className="text-muted-foreground" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image className="text-muted-foreground" />;
    default:
      return <File className="text-muted-foreground" />;
  }
}

export function getFolderIcon(isOpen: boolean): ReactNode {
  return isOpen ? (
    <FolderOpen className="text-badge-amber-indicator" />
  ) : (
    <Folder className="text-badge-amber-indicator" />
  );
}
