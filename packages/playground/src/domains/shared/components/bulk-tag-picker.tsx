import { Button } from '@mastra/playground-ui/components/Button';
import type { ButtonProps } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Popover, PopoverTrigger, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { Tag, X } from 'lucide-react';
import { useState } from 'react';

export function BulkTagPicker({
  selectedCount,
  vocabulary,
  onApplyTag,
  onRemoveTag,
  onNewTag,
  size = 'sm',
}: {
  selectedCount: number;
  vocabulary: string[];
  onApplyTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onNewTag: (tag: string) => void;
  size?: ButtonProps['size'];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = vocabulary.filter(t => t.toLowerCase().includes(search.toLowerCase()));
  const canCreate = search.trim() && !vocabulary.includes(search.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size={size} icon={<Tag />}>
          Tag {selectedCount} items
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && search.trim()) {
              e.preventDefault();
              if (canCreate) {
                onNewTag(search.trim());
              } else {
                onApplyTag(search.trim());
              }
              setSearch('');
            }
          }}
          placeholder="Search or create tag..."
          className="mb-1 h-7 text-caption"
          autoFocus
        />
        <div className="max-h-40 space-y-0.5 overflow-y-auto">
          {filtered.map(tag => (
            <div
              key={tag}
              className="flex items-center justify-between rounded px-2 py-1 text-caption hover:bg-fill-subtle"
            >
              <button type="button" onClick={() => onApplyTag(tag)} className="flex-1 text-left text-muted-foreground">
                {tag}
              </button>
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="ml-2 text-placeholder hover:text-negative1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                onNewTag(search.trim());
                setSearch('');
              }}
              className="w-full rounded px-2 py-1 text-left text-caption text-accent1 hover:bg-fill-subtle"
            >
              Create &amp; apply &quot;{search.trim()}&quot;
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
