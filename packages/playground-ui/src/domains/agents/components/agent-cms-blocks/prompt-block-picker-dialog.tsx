import { useState } from 'react';
import { FileText, Search } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from '@/ds/components/Dialog';
import { Txt } from '@/ds/components/Txt';
import { Spinner } from '@/ds/components/Spinner';
import { cn } from '@/lib/utils';
import { useStoredPromptBlocks } from '@/domains/prompt-blocks';

interface PromptBlockPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (blockId: string) => void;
}

export function PromptBlockPickerDialog({ open, onOpenChange, onSelect }: PromptBlockPickerDialogProps) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useStoredPromptBlocks();

  const blocks = data?.promptBlocks ?? [];
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
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearch('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a prompt block</DialogTitle>
          <DialogDescription>Choose a saved prompt block to reference</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-md border border-border1 bg-surface2 px-3 py-2">
              <Search className="h-4 w-4 text-neutral3" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search prompt blocks..."
                className="flex-1 bg-transparent text-ui-sm text-neutral6 placeholder:text-neutral3 outline-none"
              />
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-neutral3">
                <Spinner className="h-6 w-6" />
                <Txt variant="ui-sm">Loading prompt blocks...</Txt>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-neutral3">
                <FileText className="h-8 w-8" />
                <Txt variant="ui-sm">{search ? 'No matching prompt blocks' : 'No prompt blocks available'}</Txt>
              </div>
            ) : (
              <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
                {filtered.map(block => (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => handleSelect(block.id)}
                    className={cn(
                      'flex flex-col gap-0.5 rounded-md px-3 py-2 text-left',
                      'hover:bg-surface4 active:bg-surface5 transition-colors',
                    )}
                  >
                    <Txt variant="ui-sm" className="text-neutral6 font-medium">
                      {block.name}
                    </Txt>
                    {block.description && (
                      <Txt variant="ui-xs" className="text-neutral3 line-clamp-1">
                        {block.description}
                      </Txt>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
