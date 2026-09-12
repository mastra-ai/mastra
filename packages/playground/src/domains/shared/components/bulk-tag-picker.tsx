import { Button } from '@mastra/playground-ui/components/Button';
import type { ButtonProps } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Popover, PopoverTrigger, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { Icon } from '@mastra/playground-ui/icons/Icon';
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
        <Button variant="outline" size={size}>
          <Icon size="sm">
            <Tag />
          </Icon>
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
          className="text-ui-sm mb-1 h-7"
          autoFocus
        />
        <div className="max-h-40 space-y-0.5 overflow-y-auto">
          {filtered.map(tag => (
            <div key={tag} className="hover:bg-surface3 text-ui-sm flex items-center justify-between rounded px-2 py-1">
              <button type="button" onClick={() => onApplyTag(tag)} className="text-neutral4 flex-1 text-left">
                {tag}
              </button>
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="text-neutral2 hover:text-negative1 ml-2"
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
              className="hover:bg-surface3 text-accent1 text-ui-sm w-full rounded px-2 py-1 text-left"
            >
              Create &amp; apply &quot;{search.trim()}&quot;
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
