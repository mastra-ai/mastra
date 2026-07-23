import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { WorkspaceFile } from '../../../../../shared/api/types';
import { CopyIcon } from '../../../ui/icons';
import { highlightCode, languageForPath } from '../../../ui/highlight';
import { Markdown } from '../../../ui/Markdown';

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
}

export function WorkspaceFileViewer({ filePath, file, isLoading, error }: WorkspaceFileViewerProps) {
  const content = file?.content ?? '';
  const language = languageForPath(file?.path ?? filePath);
  const isMarkdown = language === 'markdown';

  const copy = async () => {
    if (!content) return;
    await navigator.clipboard?.writeText(content);
  };

  return (
    <section
      className="flex h-full min-w-0 flex-col border-l border-border1 bg-surface1"
      aria-label="Workspace file viewer"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border1 px-3 py-2 pl-10 lg:pl-3">
        <div className="min-w-0">
          <Txt variant="ui-sm" className="truncate font-medium text-icon6">
            {file?.name ?? filePath ?? 'Select a file'}
          </Txt>
          <Txt variant="ui-xs" className="truncate text-icon3">
            {file?.path ?? filePath ?? 'No file selected'}
          </Txt>
        </div>
        <div className="ml-auto flex shrink-0 items-center justify-end">
          {file?.contentType === 'text' ? (
            <Button size="sm" variant="ghost" onClick={copy} aria-label="Copy file contents">
              <CopyIcon />
            </Button>
          ) : null}
        </div>
      </div>

      {file ? (
        <div className="flex gap-3 border-b border-border1 px-3 py-2 text-xs text-icon3">
          <span>{formatBytes(file.size)}</span>
          <span>{new Date(file.updatedAt).toLocaleString()}</span>
          {file.truncated ? <span>Truncated</span> : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {!filePath ? <Txt className="text-icon3">Select a file to preview it here.</Txt> : null}
        {filePath && isLoading ? <Txt className="text-icon3">Loading file…</Txt> : null}
        {error ? <Txt className="text-icon4">Unable to load this file.</Txt> : null}
        {file?.contentType === 'unsupported' ? (
          <Txt className="text-icon3">This file type cannot be previewed as text.</Txt>
        ) : null}
        {file?.contentType === 'text' && isMarkdown ? <Markdown className="max-w-none">{content}</Markdown> : null}
        {file?.contentType === 'text' && !isMarkdown ? (
          <pre className="m-0 overflow-x-auto rounded-md border border-border1 bg-surface2 p-3 font-mono text-xs leading-relaxed text-icon6">
            <code dangerouslySetInnerHTML={{ __html: highlightCode(content, language) }} />
          </pre>
        ) : null}
      </div>
    </section>
  );
}
