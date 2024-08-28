'use client';

import { useState } from 'react';

import IconButton from '@/components/ui/icon-button';

import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';

import { Icon } from '@/app/components/icon';

import { codeToHtml } from 'shiki/bundle/web';

interface CodeBlockProps {
  snippet: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ snippet }) => {
  const [_, CopyFn, isCodeBlockCopied] = useCopyToClipboard();
  const [codeBlock, setCodeBlock] = useState<string | null>(null);

  const getCodeBlock = async () => {
    const html = await codeToHtml(snippet, {
      theme: 'vitesse-dark',
      lang: 'ts',
    });

    return html;
  };
  getCodeBlock().then(html => setCodeBlock(html));

  return (
    <div className="px-8 h-full grid place-items-center max-w-full overflow-auto">
      <div className="w-full h-max relative group">
        <IconButton
          onClick={() => CopyFn(snippet)}
          variant={'secondary'}
          className="absolute top-4 right-4 w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
        >
          {isCodeBlockCopied ? (
            <Icon name="check" className="text-white" />
          ) : (
            <Icon name="clipboard" className="text-white" />
          )}
        </IconButton>
        <div
          dangerouslySetInnerHTML={{
            __html: codeBlock || '',
          }}
        />
      </div>
    </div>
  );
};
