import { memo, useMemo, useState } from 'react';
import type { MouseEvent, MouseEventHandler, ReactNode } from 'react';
import Markdown from 'react-markdown';
import type { Components, ExtraProps, Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remend from 'remend';

import { rehypeArriving } from './arriving';
import { splitBlocks } from './blocks';
import { useReveal } from './use-reveal';
import { CodeBlock } from '@/ds/components/CodeBlock';
import { cn } from '@/lib/utils';

import './markdown-renderer.css';

export type MarkdownExternalLinkTarget = 'tab' | 'window';

export interface MarkdownRendererProps {
  children: string;
  className?: string;
  externalLinkTarget?: MarkdownExternalLinkTarget;
  /** The text is still being written: reveal it at a steady pace, word by word. */
  streaming?: boolean;
}

/**
 * Renders a markdown string. Agent output can carry attacker-influenced text
 * (file contents, tool output, web pages): react-markdown escapes raw HTML and
 * drops dangerous link schemes, so nothing here reaches the DOM as markup.
 *
 * react-markdown re-parses on every render, and a streaming reply re-renders
 * its whole transcript on every delta. Memoizing spares the settled messages;
 * rendering block by block — streaming or not — spares every block of the live
 * one but the last, and lets a reply settle without remounting what is already
 * on screen.
 *
 * A streamed reply is paced here rather than by the caller, so the text a block
 * parses and the text a reader sees are one and the same string. Only what lands
 * after the reader joined plays an entrance: a reply opened part-written is
 * already there, and fading in what someone is halfway through reading would be
 * both a lie and a screenful of animations at once.
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  children,
  className,
  externalLinkTarget = 'tab',
  streaming = false,
}: MarkdownRendererProps) {
  const full = decodeEscapedNewlines(children);
  const shown = useReveal(full, streaming);
  const blocks = useMemo(() => splitBlocks(shown), [shown]);
  const last = blocks.length - 1;
  const components = externalLinkTarget === 'window' ? WINDOW_COMPONENTS : COMPONENTS;
  const growing = streaming || shown !== full;

  const [joined] = useState(() =>
    streaming ? { blocks: blocks.length, words: countWords(blocks[last] ?? '') } : undefined,
  );

  // What a block held when the reader joined, and so never animates. A block
  // already whole by then holds all of itself, which is what `undefined` says:
  // leave it as plain text, no spans at all. Position decides it, so it never
  // changes under a word — and counting the source counts its markers too, so
  // the boundary only ever errs towards leaving a word unanimated.
  const settledWords = (index: number): number | undefined => {
    if (!joined || index < joined.blocks - 1) return undefined;

    return index === joined.blocks - 1 ? joined.words : 0;
  };

  const tail = blocks[last] ?? '';
  const mended = useMemo(() => (growing ? remend(tail, REMEND_OPTIONS) : tail), [growing, tail]);

  return (
    <div className={cn('mastra-markdown', className)}>
      {blocks.map((block, index) => (
        <MarkdownBlock
          key={index}
          content={index === last ? mended : block}
          settledWords={settledWords(index)}
          components={components}
        />
      ))}
    </div>
  );
});

/** Keyed by position at the call site: a content key remounts on every character. */
const MarkdownBlock = memo(function MarkdownBlock({
  components,
  content,
  settledWords,
}: {
  components: Components;
  content: string;
  settledWords?: number;
}) {
  const rehypePlugins = useMemo(
    () => (settledWords === undefined ? SETTLED : [rehypeArriving(settledWords)]),
    [settledWords],
  );

  return (
    <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={rehypePlugins} components={components}>
      {content}
    </Markdown>
  );
});

const SETTLED: Options['rehypePlugins'] = [];

function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

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

function MarkdownCodeBlock({
  node,
  children,
  className,
}: {
  node?: MarkdownNode;
  children?: ReactNode;
  className?: string;
}) {
  const fenced = fencedCode(node);
  if (!fenced) return <pre className={className}>{children}</pre>;

  return (
    <CodeBlock
      code={fenced.code}
      lang={fenced.language}
      overflow="scroll"
      className={cn('my-3 bg-surface1', className)}
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

// Links stay text until their URL lands: remend's placeholder href would render
// a live anchor to nowhere. No math is rendered here, so pairing `$$` would only
// turn one literal into another.
const REMEND_OPTIONS = { katex: false, linkMode: 'text-only' } as const;

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
