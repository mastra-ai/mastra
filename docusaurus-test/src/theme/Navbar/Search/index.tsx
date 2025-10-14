import React from 'react';
import {
  Dialog,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { Button } from '@site/src/components/ui/button';
import { CustomSearchWithoutAI } from '@site/src/components/custom-search';

const INPUTS = new Set(['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA']);

export function Shortcut() {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.userAgent.includes('Mac'));
  }, []);

  return (
    <kbd className="flex items-center gap-1 text-xs font-medium text-(--mastra-icons-3)">
      {isMac ? (
        <span className="inline-flex gap-1 items-center">
          <span className="text-base">⌘</span>
          <span>K</span>
        </span>
      ) : (
        'CTRL K'
      )}
    </kbd>
  );
}

export default function SearchContainer({ locale }: { locale: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isAgentMode, setIsAgentMode] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const el = document.activeElement;
      if (!el || INPUTS.has(el.tagName) || (el as HTMLElement).isContentEditable) {
        return;
      }
      if (
        event.key === '/' ||
        (event.key === 'k' && !event.shiftKey && (navigator.userAgent.includes('Mac') ? event.metaKey : event.ctrlKey))
      ) {
        event.preventDefault();
        // prevent to scroll to top
        setIsOpen(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function open() {
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setIsAgentMode(false);
  }

  const searchOptions = {
    indexName: 'crawler_mastra crawler',
    hitsPerPage: 20,
    attributesToRetrieve: ['title', 'content', 'url', 'hierarchy'],
    attributesToHighlight: ['title', 'content'],
    attributesToSnippet: ['content:15'],
    filters: `locale:${locale}`,
    snippetEllipsisText: '…',
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          onClick={open}
          size="sm"
          variant="ghost"
          className="md:flex hidden w-[460px]  items-center pr-[0.38rem] text-sm font-normal justify-between gap-6 cursor-pointer border-[0.5px] bg-(--mastra-surface-4) border-(--border)  text-(--mastra-icons-3)"
        >
          <span className="text-sm">Search or ask AI..</span>
          <Shortcut />
        </Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 transition-opacity z-[250]  bg-black/70" />
        <DialogContent className="dialog-panel z-[260] fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2  w-full">
          <div className="flex items-start relative top-1/2 justify-center min-h-full p-4">
            <div className="border-[0.5px] w-[32rem] border-[var(--light-border-code)] duration-150 ease-out data-closed:transform-[scale(95%)] data-closed:opacity-0 dark:border-pink-200 h-fit max-w-[660px] mx-auto rounded-xl bg-(--ifm-background-color) dark:bg-surface-4 transition-all">
              <DialogTitle className="sr-only">Search</DialogTitle>
              <div className="w-full">
                {isAgentMode ? null : <CustomSearchWithoutAI searchOptions={searchOptions} closeModal={close} />}
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
