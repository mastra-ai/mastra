import { Input, Popover, PopoverTrigger, PopoverContent, Txt } from '@mastra/playground-ui';
import { X, Plus } from 'lucide-react';
import { useState, useRef } from 'react';

export function TagPicker({
  tags,
  vocabulary,
  onSetTags,
}: {
  tags: string[];
  vocabulary: string[];
  onSetTags: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = vocabulary.filter(t => !tags.includes(t) && t.toLowerCase().includes(search.toLowerCase()));

  const canCreate = search.trim() && !vocabulary.includes(search.trim()) && !tags.includes(search.trim());

  const addTag = (tag: string) => {
    onSetTags([...tags, tag]);
    setSearch('');
  };

  const removeTag = (tag: string) => {
    onSetTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault();
      addTag(search.trim());
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-accent1/10 text-accent1 text-[10px] font-medium"
        >
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="hover:text-accent1/70">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] text-neutral3 hover:text-neutral5 hover:bg-surface3 transition-colors"
          >
            <Plus className="w-3 h-3" />
            tag
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <Input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or create tag..."
            className="h-7 text-xs mb-1"
            autoFocus
          />
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {filtered.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-surface3 text-neutral4"
              >
                {tag}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={() => addTag(search.trim())}
                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-surface3 text-accent1"
              >
                Create &quot;{search.trim()}&quot;
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <Txt variant="ui-xs" className="text-neutral3 px-2 py-1 block">
                No tags available
              </Txt>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
