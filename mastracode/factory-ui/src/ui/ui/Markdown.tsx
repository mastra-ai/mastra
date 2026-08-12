import { CodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components, ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownNode = NonNullable<ExtraProps['node']>;

function languageOf(node: MarkdownNode): string | undefined {
  const classNames = node.properties.className;
  if (!Array.isArray(classNames)) return undefined;

  const language = classNames.find(entry => typeof entry === 'string' && entry.startsWith('language-'));
  return typeof language === 'string' ? language.slice('language-'.length) : undefined;
}

function fencedCode(node: MarkdownNode | undefined): { code: string; language?: string } | undefined {
  const child = node?.children.find(entry => entry.type === 'element' && entry.tagName === 'code');
  if (child?.type !== 'element') return undefined;

  const code = child.children.map(entry => (entry.type === 'text' ? entry.value : '')).join('');
  return { code: code.replace(/\n$/, ''), language: languageOf(child) };
}

function MarkdownCodeBlock({ node, children }: { node?: MarkdownNode; children?: ReactNode }) {
  const fenced = fencedCode(node);
  if (!fenced) return <pre>{children}</pre>;

  return (
    <CodeBlock
      code={fenced.code}
      lang={fenced.language}
      overflow="scroll"
      className="bg-surface1 my-3"
      copyMessage="Copied code to clipboard"
    />
  );
}

// Props are listed one by one: react-markdown also passes its `node`, which
// React would forward to the DOM as a stray attribute.
const components: Components = {
  pre: MarkdownCodeBlock,
  a: ({ href, title, children }) => (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
};

interface MarkdownProps {
  children: string;
  className?: string;
}

/**
 * Renders a markdown string. Agent output can carry attacker-influenced text
 * (file contents, tool output, web pages): react-markdown escapes raw HTML and
 * drops dangerous link schemes, so nothing here reaches the DOM as markup.
 */
export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={className ? `mc-markdown ${className}` : 'mc-markdown'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
