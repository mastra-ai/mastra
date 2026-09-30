import { useWorkspaceFileContent } from '../hooks/use-workspace-file-content';
import { useWorkspaceContext } from './use-workspace-context';
import { CodeBlock } from '@/ds/components/CodeBlock';
import { languageForPath } from '@/ds/components/CodeEditor/highlight';
import { EmptyState } from '@/ds/components/EmptyState';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';

const isMarkdown = (path: string) => /\.mdx?$/i.test(path);

export function WorkspaceFilePath() {
  const { activeFilePath } = useWorkspaceContext();
  if (!activeFilePath) return null;

  return (
    <Txt as="span" variant="body-sm" font="mono" tone="muted" className="truncate" data-testid="workspace-file-path">
      {activeFilePath}
    </Txt>
  );
}

export function WorkspaceActiveFileContent() {
  const { workspaceId, activeFilePath } = useWorkspaceContext();
  const { data, isLoading, isError } = useWorkspaceFileContent(workspaceId, activeFilePath);

  if (!activeFilePath) return <EmptyState variant="fill" titleSlot="Select a file" />;
  if (isLoading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2 p-4">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (isError) return <EmptyState variant="fill" tone="error" titleSlot="Could not load file" />;

  const content = data ?? '';

  return isMarkdown(activeFilePath) ? (
    <div className="p-4">
      <MarkdownRenderer>{content}</MarkdownRenderer>
    </div>
  ) : (
    <CodeBlock code={content} lang={languageForPath(activeFilePath)} overflow="scroll" className="m-4" />
  );
}
