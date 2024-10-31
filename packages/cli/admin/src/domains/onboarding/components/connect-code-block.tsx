'use client';

import { useState } from 'react';

import { CopyButton } from '@/components/ui/copy-button';

import { codeToHtml } from 'shiki/bundle/web';

interface ConnectCodeBlockProps {
  snippet: string;
  className?: string;
}

export const ConnectCodeBlock: React.FC<ConnectCodeBlockProps> = ({ snippet, className }) => {
  const [codeBlock, setCodeBlock] = useState<string | null>(null);

  const getCodeBlock = async () => {
    console.log({ snippet });
    const html = await codeToHtml(snippet, {
      theme: 'vesper',
      lang: 'ts',
      defaultColor: false,
    });

    return html;
  };
  getCodeBlock().then(html => setCodeBlock(html));

  return (
    <div className="h-[285px] border border-[#343434] w-[464px] no-border overflow-auto rounded-md relative group">
      <CopyButton
        snippet={snippet}
        classname="absolute top-4 right-4 w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
      />
      <div
        className=""
        dangerouslySetInnerHTML={{
          __html: codeBlock || '',
        }}
      />
    </div>
  );
};
