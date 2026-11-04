import { splitFrontmatter } from './frontmatter';
import { CodeBlock } from '@/ds/components/CodeBlock';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';

/** Renders a markdown file, showing any leading YAML frontmatter as a code block above the body. */
export function WorkspaceMarkdownPreview({ content }: { content: string }) {
  const { frontmatter, body } = splitFrontmatter(content);

  return (
    <>
      {frontmatter !== null && (
        <div data-testid="workspace-frontmatter" className="border-b border-border">
          <CodeBlock
            code={frontmatter}
            lang="yaml"
            overflow="wrap"
            className="rounded-none border-0 bg-transparent [&_pre]:p-4"
          />
        </div>
      )}
      <div className="p-4">
        <MarkdownRenderer>{body}</MarkdownRenderer>
      </div>
    </>
  );
}
