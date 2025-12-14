'use client';

import { ReactNode, useState, useEffect } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useBookmarks } from '@/domains/bookmarks/context/bookmark-context';
import { Bookmark, BookmarkColor } from '@/types/bookmarks';
import { cn } from '@/lib/utils';

const BOOKMARK_COLORS: { value: BookmarkColor; label: string; className: string }[] = [
  { value: 'accent1', label: 'Green', className: 'bg-accent1' },
  { value: 'accent2', label: 'Red', className: 'bg-accent2' },
  { value: 'accent3', label: 'Blue', className: 'bg-accent3' },
  { value: 'accent4', label: 'Purple', className: 'bg-accent4' },
  { value: 'accent5', label: 'Light Blue', className: 'bg-accent5' },
  { value: 'accent6', label: 'Gold', className: 'bg-accent6' },
];

export type BookmarkPopoverProps = {
  messageId: string;
  existingBookmark?: Bookmark;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function BookmarkPopover({ messageId, existingBookmark, open, onOpenChange, children }: BookmarkPopoverProps) {
  const { addBookmark, updateBookmark, removeBookmark } = useBookmarks();
  const [title, setTitle] = useState(existingBookmark?.title ?? '');
  const [color, setColor] = useState<BookmarkColor>(existingBookmark?.color ?? 'accent1');

  useEffect(() => {
    if (open) {
      setTitle(existingBookmark?.title ?? '');
      setColor(existingBookmark?.color ?? 'accent1');
    }
  }, [open, existingBookmark]);

  const handleSave = () => {
    if (existingBookmark) {
      updateBookmark(existingBookmark.id, { title, color });
    } else {
      addBookmark(messageId, title, color);
    }
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (existingBookmark) {
      removeBookmark(existingBookmark.id);
    }
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3" side="top" onOpenAutoFocus={e => e.preventDefault()}>
        <div className="space-y-3">
          <div className="grid gap-2">
            <label htmlFor="bookmark-title" className="text-ui-sm text-icon3">
              Bookmark title
            </label>
            <input
              id="bookmark-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter a title..."
              className={cn(
                'flex grow items-center text-ui-md text-icon6 border border-border1 leading-none rounded-md bg-transparent h-8 px-3 w-full',
                'focus:outline-none focus:shadow-[inset_0_0_0_1px_#18fb6f]',
                'placeholder:text-icon3',
              )}
            />
          </div>

          <div>
            <label className="text-ui-sm text-icon3 mb-2 block">Color</label>
            <div className="flex gap-2">
              {BOOKMARK_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn('w-6 h-6 rounded-full transition-all', c.className, {
                    'ring-2 ring-white ring-offset-2 ring-offset-surface3': color === c.value,
                  })}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {existingBookmark && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                Delete
              </Button>
            )}
            <Button variant="default" size="sm" onClick={handleSave} className="ml-auto">
              {existingBookmark ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
