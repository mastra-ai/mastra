import React, { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@site/src/css/utils';
import { toast } from './custom-toast';
import {
  ChatGPTIcon,
  ClaudeIcon,
  CursorIcon,
  VSCodeIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  CopyPageIcon,
} from './copy-page-icons';
import { Button } from './ui/button';

export const CopyPageButton = () => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const getMarkdownContent = () => {
    // Get the main article element which contains the markdown content
    const articleElement = document.querySelector('article .markdown');

    if (!articleElement) {
      return 'No content found';
    }

    // Simple text extraction
    const title = document.querySelector('article h1')?.textContent || '';
    const content = articleElement.textContent || '';

    return `# ${title}\n\n${content}`;
  };

  const handleCopyPage = async () => {
    try {
      const content = getMarkdownContent();
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        title: 'Error',
        description: 'Failed to copy content to clipboard',
      });
    }
  };

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

  const handleConnectToCursor = () => {
    toast({
      title: 'Connect to Cursor',
      description: 'MCP server integration coming soon. Check the documentation for updates.',
    });
  };

  const handleConnectToVSCode = () => {
    toast({
      title: 'Connect to VS Code',
      description: 'MCP server integration coming soon. Check the documentation for updates.',
    });
  };

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        onClick={handleCopyPage}
        className={cn(
          'inline-flex border border-r-0 items-center rounded-[12px] rounded-tr-none rounded-br-none gap-2 px-3 py-1.5 text-sm font-medium',
          'border-[var(--ifm-color-emphasis-300)] ',
          'bg-[var(--ifm-background-color)] hover:bg-[var(--ifm-color-emphasis-100)]',
        )}
      >
        <CopyPageIcon className="w-4 h-4" />
        <span>{copied ? 'Copied' : 'Copy page'}</span>
      </Button>

      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            className={cn(
              'inline-flex h-9  items-center rounded-[12px] rounded-tl-none rounded-bl-none justify-center p-1.5 px-2.5',
              'border border-[var(--ifm-color-emphasis-300)] ',
              'bg-[var(--ifm-background-color)] hover:bg-[var(--ifm-color-emphasis-100)]',
            )}
          >
            <ChevronDownIcon
              className={cn('w-4 h-4 transition-transform duration-200', open && 'transform rotate-180')}
            />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={cn(
              'min-w-[280px] bg-(--ifm-background-color) rounded-lg rounded-xl',
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
                'rounded-md cursor-pointer outline-none',
                'hover:bg-[var(--ifm-color-emphasis-100)]',
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
                'rounded-md cursor-pointer outline-none',
                'hover:bg-[var(--ifm-color-emphasis-100)]',
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
                'rounded-md cursor-pointer outline-none',
                'hover:bg-[var(--ifm-color-emphasis-100)]',
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
