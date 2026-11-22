import { useStoredPromptBlocks } from '@mastra/react/hooks/prompt-blocks';
import { useState } from 'react';
import { DataList } from '@/ds/components/DataList';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from '@/ds/components/Dialog';
import { EmptyState } from '@/ds/components/EmptyState';
import { SearchInput } from '@/ds/components/SearchInput';
import { Spinner } from '@/ds/components/Spinner';
import { Txt } from '@/ds/components/Txt';

import { IconFileText } from '@/ds/icons/central/IconFileText';
import { cn } from '@/utils/cn';

const PROMPT_BLOCKS_PER_PAGE = 50;

interface PromptBlockPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (blockId: string) => void;
}

export function PromptBlockPickerDialog({ open, onOpenChange, onSelect }: PromptBlockPickerDialogProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { data, isLoading, isPlaceholderData } = useStoredPromptBlocks({
    page,
    perPage: PROMPT_BLOCKS_PER_PAGE,
    status: 'published',
  });

  const blocks = data?.promptBlocks ?? [];
  const hasMore = data?.hasMore ?? false;

  const handleNextPage = () => {
    if (!isPlaceholderData) setPage(p => p + 1);
  };
  const handlePrevPage = () => {
    if (!isPlaceholderData) setPage(p => Math.max(0, p - 1));
  };
  const filtered = search
    ? blocks.filter(
        b =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.description?.toLowerCase().includes(search.toLowerCase()),
      )
    : blocks;

  const handleSelect = (blockId: string) => {
    onSelect(blockId);
    onOpenChange(false);
    setSearch('');
    setPage(0);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearch('');
      setPage(0);
    }
    onOpenChange(nextOpen);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a prompt block</DialogTitle>
          <DialogDescription>Choose a saved prompt block to reference</DialogDescription>
          <SearchInput
            label="Search prompt blocks"
            className="mt-2"
            placeholder="Search prompt blocks"
            value={search}
            onValueChange={handleSearchChange}
          />
        </DialogHeader>
        <DialogBody>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-5 text-muted-foreground">
              <Spinner />
              <Txt variant="caption">Loading prompt blocks...</Txt>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              iconSlot={<IconFileText />}
              titleSlot={search ? 'No matching prompt blocks' : 'No prompt blocks available'}
            />
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map(block => (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => handleSelect(block.id)}
                  className={cn(
                    'flex flex-col gap-0.5 rounded-md px-3 py-2 text-left',
                    'hover:bg-fill-subtle active:bg-fill',
                  )}
                >
                  <Txt variant="column" tone="ink">
                    {block.name}
                  </Txt>
                  {block.description && (
                    <Txt variant="meta" tone="muted" className="line-clamp-1">
                      {block.description}
                    </Txt>
                  )}
                </button>
              ))}
            </div>
          )}

          {(page > 0 || hasMore) && (
            <DataList.Pagination
              currentPage={page}
              hasMore={hasMore}
              onNextPage={handleNextPage}
              onPrevPage={handlePrevPage}
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
