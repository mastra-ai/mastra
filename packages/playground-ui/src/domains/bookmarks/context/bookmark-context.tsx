import { createContext, ReactNode, useContext } from 'react';
import { BookmarkContextType } from '@/types/bookmarks';
import { useBookmarksState } from '@/domains/bookmarks/hooks/use-bookmarks-state';

const defaultContextValue: BookmarkContextType = {
  bookmarks: [],
  addBookmark: () => {},
  updateBookmark: () => {},
  removeBookmark: () => {},
  getBookmarkByMessageId: () => undefined,
  scrollToBookmark: () => {},
};

export const BookmarkContext = createContext<BookmarkContextType>(defaultContextValue);

export type BookmarkProviderProps = {
  children: ReactNode;
  threadId: string;
};

export function BookmarkProvider({ children, threadId }: BookmarkProviderProps) {
  const bookmarkState = useBookmarksState({ threadId });

  return <BookmarkContext.Provider value={bookmarkState}>{children}</BookmarkContext.Provider>;
}

export const useBookmarks = () => {
  return useContext(BookmarkContext);
};
