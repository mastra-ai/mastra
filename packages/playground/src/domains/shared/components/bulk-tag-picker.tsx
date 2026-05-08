import { Button, Input, Popover, PopoverTrigger, PopoverContent, Icon } from '@mastra/playground-ui';
import { Tag, X } from 'lucide-react';
import { useState } from 'react';

export function BulkTagPicker({
  selectedCount,
  vocabulary,
  onApplyTag,
  onRemoveTag,
  onNewTag,
}: {
  selectedCount: number;
  vocabulary: string[];
  onApplyTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onNewTag: (tag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = vocabulary.filter(t => t.toLowerCase().includes(search.toLowerCase()));
  const canCreate = search.trim() && !vocabulary.includes(search.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
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
          className="h-7 text-xs mb-1"
          autoFocus
        />
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {filtered.map(tag => (
            <div key={tag} className="flex items-center justify-between px-2 py-1 text-xs rounded hover:bg-surface3">
              <button type="button" onClick={() => onApplyTag(tag)} className="text-left flex-1 text-neutral4">
                {tag}
              </button>
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="text-neutral2 hover:text-negative1 ml-2"
              >
                <X className="w-3 h-3" />
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
              className="w-full text-left px-2 py-1 text-xs rounded hover:bg-surface3 text-accent1"
            >
              Create &amp; apply &quot;{search.trim()}&quot;
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
