import type { Components } from 'react-markdown';
import { diffMarkdown, remarkDiffMarks } from './diff-markdown';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';

export interface MarkdownDiffProps {
  before: string;
  after: string;
  className?: string;
}

const PLUGINS = [remarkDiffMarks];

const COMPONENTS: Components = {
  ins: ({ node: _node, children, ...props }) => (
    <ins className="text-success-indicator underline decoration-1 underline-offset-2" {...props}>
      <span className="sr-only">Added: </span>
      {children}
    </ins>
  ),
  del: ({ node: _node, children, ...props }) => (
    <del className="text-destructive-foreground decoration-1" {...props}>
      <span className="sr-only">Removed: </span>
      {children}
    </del>
  ),
};

export function MarkdownDiff({ before, after, className }: MarkdownDiffProps) {
  const { markdown } = diffMarkdown(before, after);
  return (
    <MarkdownRenderer className={className} remarkPlugins={PLUGINS} components={COMPONENTS}>
      {markdown}
    </MarkdownRenderer>
  );
}
