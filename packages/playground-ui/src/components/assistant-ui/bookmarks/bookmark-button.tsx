'use client';

import { BookmarkIcon, BookmarkPlusIcon } from 'lucide-react';
import { useMessage } from '@assistant-ui/react';
import { useBookmarks } from '@/domains/bookmarks/context/bookmark-context';
import { BookmarkPopover } from './bookmark-popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type BookmarkButtonProps = {
  className?: string;
  isPopoverOpen?: boolean;
  onPopoverOpenChange?: (open: boolean) => void;
};

export function BookmarkButton({ className, isPopoverOpen = false, onPopoverOpenChange }: BookmarkButtonProps) {
  const message = useMessage();
  const messageId = message?.id;
  const { getBookmarkByMessageId } = useBookmarks();

  const existingBookmark = messageId ? getBookmarkByMessageId(messageId) : undefined;
  const isBookmarked = Boolean(existingBookmark);

  if (!messageId) return null;

  const handleClick = () => {
    onPopoverOpenChange?.(!isPopoverOpen);
  };

  return (
    <BookmarkPopover
      messageId={messageId}
      existingBookmark={existingBookmark}
      open={isPopoverOpen}
      onOpenChange={onPopoverOpenChange ?? (() => {})}
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn('size-6 p-1', className)}
        aria-label={isBookmarked ? 'Edit bookmark' : 'Add bookmark'}
        title={isBookmarked ? 'Edit bookmark' : 'Add bookmark'}
        onClick={handleClick}
      >
        {isBookmarked ? <BookmarkIcon className="fill-current" /> : <BookmarkPlusIcon />}
      </Button>
    </BookmarkPopover>
  );
}
