import { JSX, useLayoutEffect, useState } from 'react';
import { highlight } from './highlight';
import { BundledLanguage } from 'shiki/bundle/web';
import { IconButton } from '../IconButton/IconButton';
import { CheckIcon, CopyIcon } from 'lucide-react';

export interface CodeBlockProps {
  code: string;
  language: BundledLanguage;
  className?: string;
  cta?: React.ReactNode;
}

export const CodeBlockClass =
  'mastra:rounded-lg mastra:[&>pre]:p-4 mastra:overflow-hidden mastra:[&>pre]:!bg-surface4 mastra:[&>pre>code]:leading-5 mastra:relative';

export const CodeBlock = ({ code, language, className, cta }: CodeBlockProps) => {
  const [nodes, setNodes] = useState<JSX.Element | null>(null);

  useLayoutEffect(() => {
    void highlight(code, language).then(setNodes);
  }, [language]);

  return (
    <div className={className || CodeBlockClass}>
      {nodes ?? null}
      {cta}
    </div>
  );
};

export interface CodeCopyButtonProps {
  code: string;
}

export const CodeCopyButton = ({ code }: CodeCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  return (
    <div className="mastra:absolute mastra:top-2 mastra:right-2">
      <IconButton tooltip="Copy" onClick={handleCopy}>
        {isCopied ? <CheckIcon /> : <CopyIcon />}
      </IconButton>
    </div>
  );
};
