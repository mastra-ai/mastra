/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense, useState, useEffect } from 'react';
import Markdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ThemedToken } from 'shiki';

import { cn } from '../lib/utils';

import { CopyButton } from './copy-button';
import { highlight } from './syntax-highlighter';

interface MarkdownRendererProps {
  children?: string;
}

export function MarkdownRenderer({ children }: MarkdownRendererProps) {
  const processedText = children?.replace(/\\n/g, '\n');

  return (
    <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS as Components} className="space-y-3">
      {processedText}
    </Markdown>
  );
}

interface HighlightedPre extends React.HTMLAttributes<HTMLPreElement> {
  children: string;
  language: string;
}

const HighlightedPre = React.memo(({ children, language, ...props }: HighlightedPre) => {
  const [tokens, setTokens] = useState<ThemedToken[][]>([]);

  useEffect(() => {
    highlight(children, language).then(tokens => {
      if (tokens) setTokens(tokens);
    });
  }, [children, language]);

  if (!tokens.length) {
    return <pre {...props}>{children}</pre>;
  }

  return (
    <pre {...props}>
      <code>
        {tokens.map((line, lineIndex) => (
          <>
            <span key={lineIndex}>
              {line.map((token, tokenIndex) => {
                const style = typeof token.htmlStyle === 'string' ? undefined : token.htmlStyle;

                return (
                  <span
                    key={tokenIndex}
                    className="text-shiki-light bg-shiki-light-bg dark:text-shiki-dark dark:bg-shiki-dark-bg"
                    style={style}
                  >
                    {token.content}
                  </span>
                );
              })}
            </span>
            {lineIndex !== tokens.length - 1 && '\n'}
          </>
        ))}
      </code>
    </pre>
  );
});
HighlightedPre.displayName = 'HighlightedCode';

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  children: React.ReactNode;
  className?: string;
  language: string;
}

export const CodeBlock = ({ children, className, language, ...restProps }: CodeBlockProps) => {
  const code = typeof children === 'string' ? children : childrenTakeAllStringContents(children);

  const preClass = cn(
    'overflow-x-scroll rounded-md border bg-background/50 p-4 font-mono text-sm [scrollbar-width:none]',
    className,
  );

  return (
    <div className="group/code relative mb-4">
      <Suspense
        fallback={
          <pre className={preClass} {...restProps}>
            {children}
          </pre>
        }
      >
        <HighlightedPre language={language} className={preClass}>
          {code}
        </HighlightedPre>
      </Suspense>

      <div className="invisible absolute right-2 top-2 flex space-x-1 rounded-lg p-1 opacity-0 transition-all duration-200 group-hover/code:visible group-hover/code:opacity-100">
        <CopyButton content={code} copyMessage="Copied code to clipboard" />
      </div>
    </div>
  );
};

interface ReactElementLike {
  props: {
    children?: unknown;
  };
}

function childrenTakeAllStringContents(element: unknown): string {
  if (typeof element === 'string') {
    return element;
  }

  if (element && typeof element === 'object' && 'props' in element) {
    const el = element as ReactElementLike;
    const children = el.props.children;

    if (Array.isArray(children)) {
      return children.map(child => childrenTakeAllStringContents(child)).join('');
    } else {
      return childrenTakeAllStringContents(children);
    }
  }

  return '';
}

export const COMPONENTS = {
  h1: withClass('h1', 'text-2xl font-semibold'),
  h2: withClass('h2', 'font-semibold text-xl'),
  h3: withClass('h3', 'font-semibold text-lg'),
  h4: withClass('h4', 'font-semibold text-base'),
  h5: withClass('h5', 'font-medium'),
  strong: withClass('strong', 'font-semibold'),
  a: withClass('a', 'text-primary underline underline-offset-2'),
  blockquote: withClass('blockquote', 'border-l-2 border-primary pl-4'),
  code: ({ children, className, ...rest }: { children?: React.ReactNode; className?: string }) => {
    const match = /language-(\w+)/.exec(className || '');
    return match ? (
      <CodeBlock className={className} language={match[1]} {...rest}>
        {children}
      </CodeBlock>
    ) : (
      <code
        className={cn(
          '[:not(pre)>&]:bg-background/50 font-mono [:not(pre)>&]:rounded-md [:not(pre)>&]:px-1 [:not(pre)>&]:py-0.5',
        )}
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }: any) => children,
  ol: withClass('ol', 'list-decimal space-y-2 pl-6'),
  ul: withClass('ul', 'list-disc space-y-2 pl-6'),
  li: withClass('li', 'my-1.5'),
  table: withClass('table', 'w-full border-collapse overflow-y-auto rounded-md border border-foreground/20'),
  th: withClass(
    'th',
    'border border-foreground/20 px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right',
  ),
  td: withClass(
    'td',
    'border border-foreground/20 px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right',
  ),
  tr: withClass('tr', 'm-0 border-t p-0 even:bg-muted'),
  p: withClass('p', 'whitespace-pre-wrap leading-relaxed'),
  hr: withClass('hr', 'border-foreground/20'),
};

function withClass(Tag: any, classes: string) {
  const Component = ({ node, ...props }: any) => <Tag className={classes} {...props} />;
  Component.displayName = Tag;
  return Component;
}

export default MarkdownRenderer;
