import * as React from 'react';
import { cn } from '@/lib/utils';
import { CodeEditor, type CodeEditorLanguage } from '@/ds/components/CodeEditor';
import { Spinner } from '@/ds/components/Spinner';
import { useWorkspaceFile } from '@/domains/workspace/hooks/use-workspace';
import { useWorkspaceContext } from './workspace-context';

export interface WorkspaceFileProps {
  className?: string;
  emptyMessage?: string;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']);

function isImageFile(path: string, mimeType?: string): boolean {
  if (mimeType?.startsWith('image/')) return true;
  const ext = path.split('.').pop()?.toLowerCase();
  return IMAGE_EXTENSIONS.has(ext || '');
}

function getCodeEditorLanguage(path: string): CodeEditorLanguage | null {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return 'json';
    case 'md':
    case 'mdx':
      return 'markdown';
    default:
      return null;
  }
}

export const WorkspaceFile = ({ className, emptyMessage = 'Select a file to preview' }: WorkspaceFileProps) => {
  const { workspaceId, selectedPath } = useWorkspaceContext();
  const { data, isLoading } = useWorkspaceFile(selectedPath ?? '', {
    workspaceId,
    enabled: !!selectedPath,
  });

  if (!selectedPath) {
    return (
      <div className={cn('flex flex-1 items-center justify-center text-xs text-neutral3', className)}>
        {emptyMessage}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('flex flex-1 items-center justify-center', className)}>
        <Spinner size="sm" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn('flex flex-1 items-center justify-center text-xs text-neutral3', className)}>
        Failed to load file
      </div>
    );
  }

  const isImage = isImageFile(selectedPath, data.mimeType);
  const language = getCodeEditorLanguage(selectedPath);
  const fileName = selectedPath.split('/').pop() || selectedPath;

  return (
    <div className="grid grid-rows-[auto_1fr] h-full">
      <div className="border-t border-accent1 px-3 py-1.5 bg-surface3">{fileName}</div>

      <div className="overflow-auto h-full">
        {isImage ? (
          <div className="flex items-center justify-center p-4">
            <img
              src={`data:${data.mimeType || 'image/png'};base64,${data.content}`}
              alt={fileName}
              className="max-h-[400px] max-w-full object-contain"
            />
          </div>
        ) : language ? (
          <CodeEditor key={selectedPath} value={data.content} language={language} showCopyButton autoFocus />
        ) : (
          <pre className="overflow-x-auto p-4 font-mono text-xs text-neutral5 whitespace-pre-wrap">{data.content}</pre>
        )}
      </div>
    </div>
  );
};
