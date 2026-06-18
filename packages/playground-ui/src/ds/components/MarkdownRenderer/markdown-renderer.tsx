import React from 'react';
import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Code } from '@/ds/components/Code';
import { CopyButton } from '@/ds/components/CopyButton';
import { Cell as TableCell, Row as TableRow, Table, TableBody, TableHeader, Th } from '@/ds/components/Table';
import { cn } from '@/lib/utils';

export type MarkdownRendererProps = {
  children: string;
};

export function MarkdownRenderer({ children }: MarkdownRendererProps) {
  const processedText = children.replace(/\\n/g, '\n');

  return (
    <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS} className="space-y-3">
      {processedText}
    </Markdown>
  );
}

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  children: React.ReactNode;
  className?: string;
  language: string;
}

const CodeBlock = ({ children, className, language, ...restProps }: CodeBlockProps) => {
  const code = typeof children === 'string' ? children : childrenTakeAllStringContents(children);

  const preClass = cn(
    'overflow-x-scroll rounded-md border bg-surface1/50 p-4 font-mono text-sm [scrollbar-width:none]',
    className,
  );

  return (
    <div className="group/code relative mb-4">
      <Code code={code} lang={language} className={preClass} {...restProps} />

      <div className="invisible absolute right-2 top-2 flex gap-1 rounded-lg p-1 opacity-0 transition-all duration-200 group-hover/code:visible group-hover/code:opacity-100">
        <CopyButton content={code} copyMessage="Copied code to clipboard" />
      </div>
    </div>
  );
};

function childrenTakeAllStringContents(element: any): string {
  if (typeof element === 'string') {
    return element;
  }

  if (element?.props?.children) {
    let children = element.props.children;

    if (Array.isArray(children)) {
      return children.map(child => childrenTakeAllStringContents(child)).join('');
    } else {
      return childrenTakeAllStringContents(children);
    }
  }

  return '';
}

function getMarkdownTableAlignClass(align?: string) {
  if (align === 'center') return 'text-center [&>div]:justify-center';
  if (align === 'right') return 'text-right [&>div]:justify-end';
  return undefined;
}

// Create component wrappers with className
const COMPONENTS: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-2xl font-semibold" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="font-semibold text-xl" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="font-semibold text-lg" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="font-semibold text-base" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="font-medium" {...props}>
      {children}
    </h5>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold" {...props}>
      {children}
    </strong>
  ),
  a: ({ children, ...props }) => (
    <a className="underline underline-offset-2" {...props}>
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-2 border-neutral6 pl-4" {...props}>
      {children}
    </blockquote>
  ),
  code: ({ children, className, ...rest }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    return match ? (
      <CodeBlock className={className} language={match[1]} {...rest}>
        {children}
      </CodeBlock>
    ) : (
      <code
        className={cn(
          'font-mono [:not(pre)>&]:rounded-md [:not(pre)>&]:bg-surface1/50 [:not(pre)>&]:px-1 [:not(pre)>&]:py-0.5',
        )}
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }: any) => children,
  ol: ({ children, ...props }) => (
    <ol className="list-decimal space-y-2 pl-6" {...props}>
      {children}
    </ol>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc space-y-2 pl-6" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }) => (
    <li className="my-1.5" {...props}>
      {children}
    </li>
  ),
  table: ({ children }) => <Table size="small">{children}</Table>,
  thead: ({ children, node: _node, ...props }: any) => <TableHeader {...props}>{children}</TableHeader>,
  tbody: ({ children, node: _node, ...props }: any) => <TableBody {...props}>{children}</TableBody>,
  th: ({ children, align, node: _node, ...props }: any) => (
    <Th className={cn('px-4 py-2 font-bold', getMarkdownTableAlignClass(align))} align={align} {...props}>
      {children}
    </Th>
  ),
  td: ({ children, align, node: _node, ...props }: any) => (
    <TableCell className={cn('px-4 py-2', getMarkdownTableAlignClass(align))} align={align} {...props}>
      {children}
    </TableCell>
  ),
  tr: ({ children, node: _node, ...props }: any) => <TableRow {...props}>{children}</TableRow>,
  p: ({ children, ...props }) => (
    <p className="whitespace-pre-wrap leading-relaxed" {...props}>
      {children}
    </p>
  ),
  hr: ({ ...props }) => <hr className="border-neutral6/20" {...props} />,
};

export default MarkdownRenderer;
