import { Button } from '@mastra/playground-ui/components/Button';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowLeft } from 'lucide-react';

import type { WorkspaceFile } from '../../../../api/types';
import { CopyIcon } from '../../../ui/icons';
import { highlightCode, languageForPath } from '../../../ui/highlight';

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

interface WorkspaceFileViewerProps {
  filePath?: string;
  file?: WorkspaceFile;
  isLoading: boolean;
  error?: Error;
  onBack: () => void;
}

export function WorkspaceFileViewer({ filePath, file, isLoading, error, onBack }: WorkspaceFileViewerProps) {
  const content = file?.content ?? '';
  const language = languageForPath(file?.path ?? filePath);
  const isMarkdown = language === 'markdown';

  const copyFile = async () => {
    if (content) await navigator.clipboard?.writeText(content);
  };

  return (
    <section className="flex h-full min-w-0 flex-col" aria-label="Workspace file viewer">
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
        <Txt variant="ui-sm" className="text-icon6 min-w-0 truncate font-medium">
          {file?.name ?? filePath}
        </Txt>
        {file?.contentType === 'text' ? (
          <Button
            size="icon-sm"
            variant="ghost"
            className="ml-auto shrink-0"
            onClick={copyFile}
            aria-label="Copy file contents"
          >
            <CopyIcon />
          </Button>
        ) : null}
      </div>

      {file ? (
        <div className="border-border1 text-icon3 flex shrink-0 items-center gap-3 border-b px-3 py-2 text-xs">
          <span className="min-w-0 truncate">{file.path}</span>
          <span className="ml-auto shrink-0">{formatBytes(file.size)}</span>
          <span className="shrink-0">{new Date(file.updatedAt).toLocaleString()}</span>
          {file.truncated ? <span className="shrink-0">Truncated</span> : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {!filePath ? <Txt className="text-icon3">Select a file to preview it here.</Txt> : null}
        {filePath && isLoading ? <Txt className="text-icon3">Loading file…</Txt> : null}
        {error ? <Txt className="text-icon4">Unable to load this file.</Txt> : null}
        {file?.contentType === 'unsupported' ? (
          <Txt className="text-icon3">This file type cannot be previewed as text.</Txt>
        ) : null}
        {file?.contentType === 'text' && isMarkdown ? <MarkdownRenderer>{content}</MarkdownRenderer> : null}
        {file?.contentType === 'text' && !isMarkdown ? (
          <pre className="border-border1 bg-surface2 text-icon6 m-0 overflow-x-auto rounded-md border p-3 font-mono text-xs leading-relaxed">
            <code dangerouslySetInnerHTML={{ __html: highlightCode(content, language) }} />
          </pre>
        ) : null}
      </div>
    </section>
  );
}
