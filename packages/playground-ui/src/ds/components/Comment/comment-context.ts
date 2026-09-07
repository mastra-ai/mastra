import { createContext, useContext } from 'react';

export type CommentVariant = 'default' | 'embed';

export const CommentContext = createContext<CommentVariant | null>(null);

export function useCommentVariant(): CommentVariant {
  const variant = useContext(CommentContext);
  if (!variant) throw new Error('Comment compounds must be rendered within Comment');
  return variant;
}
