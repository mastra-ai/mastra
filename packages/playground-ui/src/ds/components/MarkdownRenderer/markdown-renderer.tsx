import { memo } from 'react';
import type { MouseEvent, MouseEventHandler, ReactNode } from 'react';
import Markdown from 'react-markdown';
import type { Components, ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { rehypeWordSpans } from './word-spans';
import { CodeBlock } from '@/ds/components/CodeBlock';
import { cn } from '@/lib/utils';

import './markdown-renderer.css';

export type MarkdownExternalLinkTarget = 'tab' | 'window';

export interface MarkdownRendererProps {
  children: string;
  className?: string;
  externalLinkTarget?: MarkdownExternalLinkTarget;
  /** The text is still being written: fade each word in as it lands. */
  streaming?: boolean;
}

/**
 * Renders a markdown string. Agent output can carry attacker-influenced text
 * (file contents, tool output, web pages): react-markdown escapes raw HTML and
 * drops dangerous link schemes, so nothing here reaches the DOM as markup.
 *
 * Memoized because react-markdown re-parses on every render and a streaming
 * reply re-renders its whole transcript on every delta: without this, each
 * chunk re-parses every settled message on the page as well as the live one.
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  children,
  className,
  externalLinkTarget = 'tab',
  streaming = false,
}: MarkdownRendererProps) {
  return (
    <Markdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={streaming ? WORD_SPAN_PLUGINS : undefined}
      components={externalLinkTarget === 'window' ? WINDOW_COMPONENTS : COMPONENTS}
      className={cn('mastra-markdown', streaming && 'mastra-markdown-streaming', className)}
    >
      {decodeEscapedNewlines(children)}
    </Markdown>
  );
});

// Agent networks emit their text with literal `\n`. Only unescape when the text
// has no real newline, otherwise a `"a\nb"` inside a code fence gets shredded.
function decodeEscapedNewlines(text: string): string {
  return text.includes('\n') ? text : text.replace(/\\n/g, '\n');
}

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

const POPUP_WINDOW_FEATURES = 'popup=yes,width=720,height=800,resizable=yes,scrollbars=yes';

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function markdownLink(externalLinkTarget: MarkdownExternalLinkTarget): NonNullable<Components['a']> {
  return function MarkdownLink({ href, title, children }) {
    const isExternal = /^https?:\/\//i.test(href ?? '');

    const openInPopup: MouseEventHandler<HTMLAnchorElement> = event => {
      if (!isExternal || externalLinkTarget !== 'window' || !isPlainLeftClick(event)) return;

      const popup = window.open(href, '_blank', POPUP_WINDOW_FEATURES);
      if (!popup) return;

      popup.opener = null;
      event.preventDefault();
    };

    return (
      <a
        href={href}
        title={title}
        onClick={openInPopup}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    );
  };
}

const REMARK_PLUGINS = [remarkGfm];
const WORD_SPAN_PLUGINS = [rehypeWordSpans];

// Elements are listed one by one: react-markdown also passes its `node`, which
// React would forward to the DOM as a stray attribute. Everything else is
// styled from markdown-renderer.css.
const COMPONENTS: Components = {
  pre: MarkdownCodeBlock,
  a: markdownLink('tab'),
};

const WINDOW_COMPONENTS: Components = {
  ...COMPONENTS,
  a: markdownLink('window'),
};
