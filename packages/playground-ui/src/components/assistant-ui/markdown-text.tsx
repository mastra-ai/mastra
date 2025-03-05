'use client';

import {
  CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from '@assistant-ui/react-markdown';
import '@assistant-ui/react-markdown/styles/dot.css';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { FC, memo, useState } from 'react';
import remarkGfm from 'remark-gfm';
import { makePrismAsyncSyntaxHighlighter } from '@assistant-ui/react-syntax-highlighter';
import { coldarkDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

const SyntaxHighlighter = makePrismAsyncSyntaxHighlighter({
  style: coldarkDark,
  customStyle: {
    margin: 0,
    backgroundColor: 'black',
  },
});

import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';

import { cn } from '@/lib/utils';

const MarkdownTextImpl = () => {
  return <MarkdownTextPrimitive remarkPlugins={[remarkGfm]} className="aui-md" components={defaultComponents} />;
};

export const MarkdownText = memo(MarkdownTextImpl);

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div
      style={{
        background: 'hsl(0 0% 100% / 0.06)',
        borderTopRightRadius: '0.5rem',
        borderTopLeftRadius: '0.5rem',
        marginTop: '0.5rem',
        border: '1px solid hsl(0 0% 20.4%)',
        borderBottom: 'none',
      }}
      className="flex items-center justify-between gap-4 px-4 py-2 text-sm font-semibold text-white"
    >
      <span className="lowercase [&>span]:text-xs">{language}</span>
      <TooltipIconButton tooltip="Copy" onClick={onCopy}>
        <span className="grid">
          <span
            key="checkmark"
            style={{
              gridArea: '1/1',
            }}
            className={cn('transition-transform', isCopied ? 'scale-100' : 'scale-0')}
          >
            <CheckIcon size={14} />
          </span>
          <span
            style={{
              gridArea: '1/1',
            }}
            className={cn('transition-transform', isCopied ? 'scale-0' : 'scale-100')}
            key="copy"
          >
            <CopyIcon size={14} />
          </span>
        </span>
      </TooltipIconButton>
    </div>
  );
};

const useCopyToClipboard = ({
  copiedDuration = 1500,
}: {
  copiedDuration?: number;
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
};

const defaultComponents = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1
      className={cn('mb-8 scroll-m-20 text-4xl font-extrabold tracking-tight last:mb-0', className)}
      {...props}
      style={{
        marginBottom: '2rem',
      }}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn('mb-4 mt-8 scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0 last:mb-0', className)}
      {...props}
      style={{
        marginBottom: '1rem',
        marginTop: '2rem',
      }}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn('scroll-m-20 text-2xl font-semibold tracking-tight first:mt-0 last:mb-0', className)}
      {...props}
      style={{
        marginBottom: '1rem',
        marginTop: '1.5rem',
      }}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={cn('scroll-m-20 text-xl font-semibold tracking-tight first:mt-0 last:mb-0', className)}
      {...props}
      style={{
        marginBottom: '1rem',
        marginTop: '1.5rem',
      }}
    />
  ),
  h5: ({ className, ...props }) => (
    <h5
      className={cn('font-semibold first:mt-0 last:mb-0', className)}
      {...props}
      style={{
        marginBottom: '1rem',
        marginTop: '1rem',
      }}
    />
  ),
  h6: ({ className, ...props }) => (
    <h6
      className={cn('font-semibold first:mt-0 last:mb-0', className)}
      {...props}
      style={{
        marginBottom: '1rem',
        marginTop: '1rem',
      }}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn('leading-7 first:mt-0 last:mb-0', className)}
      {...props}
      style={{
        marginBottom: '1.25rem',
        marginTop: '1.25rem',
      }}
    />
  ),
  a: ({ className, ...props }) => (
    <a className={cn('text-primary font-medium underline underline-offset-4', className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote className={cn('border-l-2 pl-6 italic', className)} {...props} />
  ),
  ul: ({ className, ...props }) => <ul className={cn('my-5 ml-6 list-disc [&>li]:mt-2', className)} {...props} />,
  ol: ({ className, ...props }) => <ol className={cn('my-5 ml-6 list-decimal [&>li]:mt-2', className)} {...props} />,
  hr: ({ className, ...props }) => <hr className={cn('my-5 border-b', className)} {...props} />,
  table: ({ className, ...props }) => (
    <table className={cn('my-5 w-full border-separate border-spacing-0 overflow-y-auto', className)} {...props} />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        'bg-muted px-4 py-2 text-left font-bold first:rounded-tl-lg last:rounded-tr-lg [&[align=center]]:text-center [&[align=right]]:text-right',
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        'border-b border-l px-4 py-2 text-left last:border-r [&[align=center]]:text-center [&[align=right]]:text-right',
        className,
      )}
      {...props}
    />
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={cn(
        'm-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg',
        className,
      )}
      {...props}
    />
  ),
  sup: ({ className, ...props }) => <sup className={cn('[&>a]:text-xs [&>a]:no-underline', className)} {...props} />,
  pre: ({ className, ...props }) => (
    <pre
      {...props}
      style={{
        borderBottomRightRadius: '0.5rem',
        borderBottomLeftRadius: '0.5rem',
        background: 'transparent',
        fontSize: '0.875rem',
        marginBottom: '0.5rem',
        border: '1px solid hsl(0 0% 20.4%)',
      }}
      className={cn('overflow-x-auto p-4 text-white', className)}
    />
  ),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <pre
        style={{
          fontSize: '0.875rem',
          display: 'inline',
        }}
      >
        <code
          className={cn(!isCodeBlock && 'bg-muted rounded border font-semibold', className)}
          {...props}
          style={{
            fontWeight: '400',
            paddingBlock: !isCodeBlock ? '0.1em' : 0,
            paddingInline: !isCodeBlock ? '0.3em' : 0,
          }}
        />{' '}
      </pre>
    );
  },
  CodeHeader,
  SyntaxHighlighter,
});
