import { useState, useEffect, useCallback } from 'react';
import { Bookmark, BookmarkColor, BookmarkContextType } from '@/types/bookmarks';

export type UseBookmarksStateProps = {
  threadId: string;
};

export function useBookmarksState({ threadId }: UseBookmarksStateProps): BookmarkContextType {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const LOCAL_STORAGE_KEY = `mastra-bookmarks-${threadId}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setBookmarks(JSON.parse(stored));
      } else {
        setBookmarks([]);
      }
    } catch {
      setBookmarks([]);
    }
  }, [LOCAL_STORAGE_KEY]);

  const persistBookmarks = useCallback(
    (newBookmarks: Bookmark[]) => {
      setBookmarks(newBookmarks);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newBookmarks));
    },
    [LOCAL_STORAGE_KEY],
  );

  const addBookmark = useCallback(
    (messageId: string, title: string, color: BookmarkColor) => {
      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        messageId,
        title,
        color,
        createdAt: Date.now(),
      };
      persistBookmarks([...bookmarks, newBookmark]);
    },
    [bookmarks, persistBookmarks],
  );

  const updateBookmark = useCallback(
    (id: string, updates: Partial<Pick<Bookmark, 'title' | 'color'>>) => {
      const updated = bookmarks.map(b => (b.id === id ? { ...b, ...updates } : b));
      persistBookmarks(updated);
    },
    [bookmarks, persistBookmarks],
  );

  const removeBookmark = useCallback(
    (id: string) => {
      persistBookmarks(bookmarks.filter(b => b.id !== id));
    },
    [bookmarks, persistBookmarks],
  );

  const getBookmarkByMessageId = useCallback(
    (messageId: string) => {
      return bookmarks.find(b => b.messageId === messageId);
    },
    [bookmarks],
  );

  const scrollToBookmark = useCallback((bookmark: Bookmark) => {
    const messageElement = document.querySelector(`[data-message-id="${bookmark.messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('bg-surface4');
      setTimeout(() => {
        messageElement.classList.remove('bg-surface4');
      }, 2000);
    }
  }, []);

  return {
    bookmarks,
    addBookmark,
    updateBookmark,
    removeBookmark,
    getBookmarkByMessageId,
    scrollToBookmark,
  };
}
