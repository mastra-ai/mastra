'use client';

import { useState } from 'react';

import { CopyButton } from '@/components/ui/copy-button';

import { cn } from '@/lib/utils';

import { codeToHtml } from 'shiki/bundle/web';

interface CodeBlockProps {
  snippet: string;
  className?: HTMLDivElement['className'];
  innerClassName?: HTMLDivElement['className'];
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ snippet, className, innerClassName }) => {
  const [codeBlock, setCodeBlock] = useState<string | null>(null);

  const getCodeBlock = async () => {
    const html = await codeToHtml(snippet, {
      theme: 'vesper',
      lang: 'ts',
      defaultColor: false,
    });

    return html;
  };
  getCodeBlock().then(html => setCodeBlock(html));

  return (
    <div className={cn('h-full grid place-items-center max-w-full overflow-auto', className)}>
      <div className={cn('w-full h-max relative group', innerClassName)}>
        <CopyButton
          snippet={snippet}
          classname="absolute top-4 right-4 w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
        />
        <div
          dangerouslySetInnerHTML={{
            __html: codeBlock || '',
          }}
        />
      </div>
    </div>
  );
};
