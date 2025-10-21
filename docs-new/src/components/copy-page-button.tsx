import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@site/src/css/utils';
import { useCallback, useState } from 'react';
import { useMarkdownContent } from '../hooks/useMarkdownContent';
import { ChatGPTIcon, ChevronDownIcon, ClaudeIcon, CopyPageIcon, ExternalLinkIcon } from './copy-page-icons';
import { Button } from './ui/button';

export const CopyPageButton = () => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { getMarkdownContent } = useMarkdownContent();
  const content = getMarkdownContent();

  console.log(content);

  const handleCopyPage = useCallback(async () => {
    const content = getMarkdownContent();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleOpenInChatGPT = () => {
    const currentUrl = window.location.href;
    const query = encodeURIComponent(`Read from ${currentUrl} so I can ask questions about it.`);
    const chatGptUrl = `https://chatgpt.com/?hints=search&q=${query}`;
    window.open(chatGptUrl, '_blank');
  };

  const handleOpenInClaude = () => {
    const currentUrl = window.location.href;
    const query = encodeURIComponent(`Read from ${currentUrl} so I can ask questions about it.`);
    const claudeUrl = `https://claude.ai/new?q=${query}`;
    window.open(claudeUrl, '_blank');
  };

  return (
    <div className="flex items-center" data-copy-page-button>
      <Button
        variant="ghost"
        onClick={handleCopyPage}
        className={cn(
          'inline-flex border border-r-0 items-center rounded-[12px] rounded-tr-none rounded-br-none gap-2 px-3 py-1.5 text-sm font-medium',
          ' border-(--border) ',
          'bg-[var(--ifm-background-color)] hover:bg-[var(--ifm-color-emphasis-100)]',
        )}
      >
        <CopyPageIcon className="w-4 h-4" />
        <span>{copied ? 'Copied' : 'Copy page'}</span>
      </Button>

      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="ghost"
            className={cn(
              'inline-flex h-9  items-center rounded-[12px] rounded-tl-none rounded-bl-none justify-center p-1.5 px-2.5',
              'border border-(--border)',
              'bg-[var(--ifm-background-color)] hover:bg-[var(--ifm-color-emphasis-100)]',
            )}
          >
            <ChevronDownIcon
              className={cn('size-3 transition-transform duration-200', open && 'transform rotate-180')}
            />
          </Button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={cn(
              'min-w-[280px] bg-(--ifm-background-color) rounded-xl',
              'border border-(--ifm-color-emphasis-200)',
              'p-1 z-50',
              'animate-in fade-in-0 zoom-in-95',
            )}
            sideOffset={5}
            align="end"
          >
            <DropdownMenu.Item
              className={cn(
                'flex items-center gap-3 px-2 py-2 text-sm',
                'text-[var(--ifm-font-color-base)]',
                'rounded-lg cursor-pointer outline-none',
                'hover:bg-(--mastra-surface-2)',
                'focus:bg-[var(--ifm-color-emphasis-100)]',
                'transition-colors duration-150',
              )}
              onClick={handleCopyPage}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-(--mastra-surface-2)">
                <CopyPageIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                <div className="font-medium">Copy page</div>
                <div className="text-xs text-[var(--ifm-color-emphasis-700)]">Copy page as Markdown for LLMs</div>
              </div>
              {copied && <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>}
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={cn(
                'flex items-center gap-3 p-2 text-sm',
                'text-[var(--ifm-font-color-base)]',
                'rounded-lg cursor-pointer outline-none',
                'hover:bg-(--mastra-surface-2)',
                'focus:bg-[var(--ifm-color-emphasis-100)]',
                'transition-colors duration-150',
              )}
              onClick={handleOpenInChatGPT}
            >
              <div className="flex items-center justify-center w-8 h-8  rounded-lg bg-(--mastra-surface-2)">
                <ChatGPTIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                <div className="font-medium flex items-center gap-1.5">
                  Open in ChatGPT
                  <ExternalLinkIcon className="w-3 h-3" />
                </div>
                <div className="text-xs text-[var(--ifm-color-emphasis-700)]">Ask questions about this page</div>
              </div>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={cn(
                'flex items-center gap-3 p-2 text-sm',
                'text-[var(--ifm-font-color-base)]',
                'rounded-lg cursor-pointer outline-none',
                'hover:bg-(--mastra-surface-2)',
                'focus:bg-[var(--ifm-color-emphasis-100)]',
                'transition-colors duration-150',
              )}
              onClick={handleOpenInClaude}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-(--mastra-surface-2)">
                <ClaudeIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                <div className="font-medium flex items-center gap-1.5">
                  Open in Claude
                  <ExternalLinkIcon className="w-3 h-3" />
                </div>
                <div className="text-xs text-[var(--ifm-color-emphasis-700)]">Ask questions about this page</div>
              </div>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
};
