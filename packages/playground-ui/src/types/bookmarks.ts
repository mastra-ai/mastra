export type BookmarkColor = 'accent1' | 'accent2' | 'accent3' | 'accent4' | 'accent5' | 'accent6';

export type Bookmark = {
  id: string;
  messageId: string;
  title: string;
  color: BookmarkColor;
  createdAt: number;
};

export type BookmarkContextType = {
  bookmarks: Bookmark[];
  addBookmark: (messageId: string, title: string, color: BookmarkColor) => void;
  updateBookmark: (id: string, updates: Partial<Pick<Bookmark, 'title' | 'color'>>) => void;
  removeBookmark: (id: string) => void;
  getBookmarkByMessageId: (messageId: string) => Bookmark | undefined;
  scrollToBookmark: (bookmark: Bookmark) => void;
};
