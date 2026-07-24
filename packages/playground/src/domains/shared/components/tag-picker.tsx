import { Input } from '@mastra/playground-ui/components/Input';
import { Popover, PopoverTrigger, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Plus, X } from 'lucide-react';
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
    <div className="flex flex-wrap items-center gap-1">
      {tags.map(tag => (
        <span
          key={tag}
          className="bg-accent1/10 text-accent1 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
        >
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="hover:text-accent1/70">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-neutral3 hover:text-neutral5 hover:bg-surface3 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] transition-colors"
          >
            <Plus className="h-3 w-3" />
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
            className="mb-1 h-7 text-xs"
            autoFocus
          />
          <div className="max-h-32 space-y-0.5 overflow-y-auto">
            {filtered.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="hover:bg-surface3 text-neutral4 w-full rounded px-2 py-1 text-left text-xs"
              >
                {tag}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={() => addTag(search.trim())}
                className="hover:bg-surface3 text-accent1 w-full rounded px-2 py-1 text-left text-xs"
              >
                Create &quot;{search.trim()}&quot;
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <Txt variant="ui-xs" className="text-neutral2 px-2 py-1">
                {vocabulary.length === 0 ? 'Type to create a tag' : 'No matching tags'}
              </Txt>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
