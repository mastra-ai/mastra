import { cn } from '@site/src/css/utils';
import { useCallback, useState } from 'react';
import { useMarkdownContent } from '../hooks/useMarkdownContent';
import { CopyPageIcon } from './copy-page-icons';
import { Button } from './ui/button';

function openInChatGpt(url: string, encodeURIComponent: typeof window.encodeURIComponent) {
  const query = encodeURIComponent(`Read from the ${url} so I can ask questions about it.`);
  const chatGptUrl = `https://chatgpt.com/?hints=search&q=${query}`;
  return chatGptUrl;
}

function openInClaude(url: string, encodeURIComponent: typeof window.encodeURIComponent) {
  const query = encodeURIComponent(`Read from the ${url} so I can ask questions about it.`);
  const claudeUrl = `https://claude.ai/new?q=${query}`;
  return claudeUrl;
}

function openWindow(url: string) {
  window.open(url, '_blank');
}

export const CopyPageButton = () => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { getMarkdownContent } = useMarkdownContent();
  const content = getMarkdownContent();

  const handleCopyPage = useCallback(async () => {
    const content = getMarkdownContent();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleOpenInChatGPT = () => {
    const currentUrl = window.location.href;
    const chatGptUrl = openInChatGpt(currentUrl, encodeURIComponent);
    openWindow(chatGptUrl);
  };

  const handleOpenInClaude = () => {
    const currentUrl = window.location.href;
    const claudeUrl = openInClaude(currentUrl, encodeURIComponent);
    openWindow(claudeUrl);
  };

  return (
    <div className="flex w-full items-center" data-copy-page-button>
      <Button
        variant="ghost"
        onClick={handleCopyPage}
        className={cn(
          'inline-flex h-[32px] font-normal items-center w-full rounded-[12px] gap-2 px-3 py-1.5 text-sm',
          'bg-(--mastra-surface-3) hover:bg-(--mastra-surface-2)',
        )}
      >
        <CopyPageIcon className="w-4 h-4" />
        <span>{copied ? 'Copied' : 'Copy page'}</span>
      </Button>
    </div>
  );
};
