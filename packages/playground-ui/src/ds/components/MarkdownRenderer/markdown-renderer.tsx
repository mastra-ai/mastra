import type { Root } from 'mdast';
import { memo, useMemo } from 'react';
import type { MouseEvent, MouseEventHandler, ReactNode } from 'react';
import Markdown from 'react-markdown';
import type { Components, ExtraProps, Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remend from 'remend';

import { rehypeArriving } from './arriving';
import { splitBlocks, splitList } from './blocks';
import type { ListBlock } from './blocks';
import { MarkdownTable } from './markdown-table';
import { remarkTableMarkdown } from './table-markdown';
import { useSettledWords } from './use-settled';
import { CodeBlock } from '@/ds/components/CodeBlock';
import { cn } from '@/lib/utils';

import './markdown-renderer.css';

export type MarkdownExternalLinkTarget = 'tab' | 'window';

type RemarkPlugins = NonNullable<Options['remarkPlugins']>;
type RehypePlugins = NonNullable<Options['rehypePlugins']>;
type ListItem = 'tight' | 'loose';
type MarkdownChild = NonNullable<ExtraProps['node']>['children'][number];

export interface MarkdownRendererProps {
  children: string;
  className?: string;
  externalLinkTarget?: MarkdownExternalLinkTarget;
  /** The text is a prefix of one still being written: close the markers the stream has not reached. */
  streaming?: boolean;
  /** Opt in to table copy/download controls; disabled while this text is streaming. */
  tableActions?: boolean;
  /** Remark plugins run after the built-in ones, e.g. to turn a syntax of the host's into elements. Keep it stable. */
  remarkPlugins?: RemarkPlugins;
  /** Element overrides merged over the built-in ones. Keep it stable: a new object re-renders every block. */
  components?: Components;
}

/**
 * Renders a markdown string. Agent output can carry attacker-influenced text
 * (file contents, tool output, web pages): react-markdown escapes raw HTML and
 * drops dangerous link schemes, so nothing here reaches the DOM as markup.
 *
 * react-markdown re-parses on every render, and a streaming reply re-renders
 * its whole transcript on every delta. Memoizing spares the settled messages;
 * rendering block by block, and a list item by item — streaming or not — spares
 * every block of the live one but the last, and lets a reply settle without
 * remounting what is already on screen.
 *
 * The text is drawn as given: pacing a stream is `useRevealedText`, and belongs to
 * whoever owns the whole of what is being laid down — a reply is prose, tool rows
 * and cards, and they have to arrive in the order they were written. Only what
 * lands after the reader joined plays an entrance, and only while it is still new:
 * a reply opened part-written is already there, and fading in what someone is
 * halfway through reading would be both a lie and a screenful of animations at
 * once.
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  children,
  className,
  externalLinkTarget = 'tab',
  streaming = false,
  tableActions = false,
  remarkPlugins: extraRemarkPlugins,
  components: extraComponents,
}: MarkdownRendererProps) {
  const shown = decodeEscapedNewlines(children);
  const baseComponents = (tableActions ? TABLE_COMPONENTS : DEFAULT_COMPONENTS)[externalLinkTarget];
  const components = useMemo(
    () => (extraComponents ? { ...baseComponents, ...extraComponents } : baseComponents),
    [baseComponents, extraComponents],
  );
  // A list cut into items draws its own `<ul>`/`<ol>`, which neither an override of either nor a host plugin
  // rewriting the list would reach.
  const listsWhole = Boolean(components.ul ?? components.ol ?? extraRemarkPlugins?.length);
  const blocks = useMemo(
    () => splitBlocks(shown).map(block => (listsWhole ? block : (splitList(block) ?? block))),
    [shown, listsWhole],
  );
  const pieces = blocks.flatMap(block => (typeof block === 'string' ? block : block.items));
  const last = pieces.length - 1;

  const spans = wordSpans(pieces);
  const settled = useSettledWords(spans.at(-1)?.end ?? 0, streaming);

  // A block whose words have all finished their entrance has nothing left to play,
  // which is what `undefined` says: leave it as plain text, no spans at all.
  const settledWords = (span: WordSpan | undefined): number | undefined =>
    !span || settled >= span.end ? undefined : Math.max(0, settled - span.start);

  const tail = pieces[last] ?? '';
  const mended = useMemo(() => (streaming ? remend(tail, REMEND_OPTIONS) : tail), [streaming, tail]);

  const piece = (content: string, at: number, key: number, listItem?: ListItem) => (
    <MarkdownBlock
      key={key}
      content={at === last ? mended : content}
      settledWords={settledWords(spans[at])}
      listItem={listItem}
      components={components}
      streaming={streaming}
      tableActions={tableActions}
      extraRemarkPlugins={extraRemarkPlugins}
    />
  );
  let next = 0;

  return (
    <div className={cn('mastra-markdown', className)}>
      {blocks.map((block, index) => {
        const first = next;

        if (typeof block === 'string') {
          next += 1;
          return piece(block, first, index);
        }

        next += block.items.length;
        const listItem = block.loose ? 'loose' : 'tight';

        return (
          <MarkdownList key={index} list={block}>
            {block.items.map((item, position) => piece(item, first + position, position, listItem))}
          </MarkdownList>
        );
      })}
    </div>
  );
});

/** The list element itself, drawn once around items that were each parsed alone. */
function MarkdownList({ list, children }: { list: ListBlock; children: ReactNode[] }) {
  // react-markdown puts a line break on each side of every item; keeping them keeps the markup identical.
  const items = ['\n', ...children.flatMap(child => [child, '\n'])];
  const className = list.tasks ? 'contains-task-list' : undefined;

  if (!list.ordered) return <ul className={className}>{items}</ul>;

  return (
    <ol start={list.start === 1 ? undefined : list.start} className={className}>
      {items}
    </ol>
  );
}

/** Keyed by position at the call site: a content key remounts on every character. */
const MarkdownBlock = memo(function MarkdownBlock({
  components,
  content,
  settledWords,
  listItem,
  streaming,
  tableActions,
  extraRemarkPlugins,
}: {
  components: Components;
  content: string;
  settledWords?: number;
  /** The content is one item of a list drawn by `MarkdownList`, which says whether that list is loose. */
  listItem?: ListItem;
  streaming: boolean;
  tableActions: boolean;
  extraRemarkPlugins?: RemarkPlugins;
}) {
  const remarkPlugins = useMemo(() => {
    const builtIn = tableActions && !streaming ? COPYABLE_REMARK_PLUGINS : REMARK_PLUGINS;
    const plugins = extraRemarkPlugins ? [...builtIn, ...extraRemarkPlugins] : builtIn;
    return listItem === 'loose' ? [...plugins, remarkLooseList] : plugins;
  }, [tableActions, streaming, extraRemarkPlugins, listItem]);
  const rehypePlugins = useMemo(() => {
    const arriving = settledWords === undefined ? SETTLED : [rehypeArriving(settledWords)];
    return listItem ? [rehypeListItem, ...arriving] : arriving;
  }, [settledWords, listItem]);

  return (
    <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
      {content}
    </Markdown>
  );
});

/** An item parsed alone sits in a list of one; the list it belongs to is loose. */
function remarkLooseList() {
  return (tree: Root) => {
    for (const node of tree.children) if (node.type === 'list') node.spread = true;
  };
}

/** Keeps the item and drops the list of one around it: `MarkdownList` draws the real one. */
function rehypeListItem() {
  return (tree: { children: MarkdownChild[] }) => {
    tree.children = tree.children.flatMap(node =>
      node.type === 'element' && (node.tagName === 'ul' || node.tagName === 'ol')
        ? node.children.filter(child => child.type === 'element')
        : [node],
    );
  };
}

const SETTLED: RehypePlugins = [];

interface WordSpan {
  start: number;
  end: number;
}

/**
 * Where each block's words fall in the reply's own count, so one settled count covers
 * them all. Counting the source counts its markers too, so the boundary only ever errs
 * towards leaving a word unanimated.
 */
function wordSpans(blocks: string[]): WordSpan[] {
  let read = 0;

  return blocks.map(block => {
    const span = { start: read, end: read + countWords(block) };
    read = span.end;

    return span;
  });
}

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
      className={cn('my-3 bg-sidebar', className)}
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
const COPYABLE_REMARK_PLUGINS = [remarkGfm, remarkTableMarkdown];

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

const DEFAULT_COMPONENTS = { tab: COMPONENTS, window: WINDOW_COMPONENTS };
const TABLE_COMPONENTS = {
  tab: { ...COMPONENTS, table: MarkdownTable },
  window: { ...WINDOW_COMPONENTS, table: MarkdownTable },
};
