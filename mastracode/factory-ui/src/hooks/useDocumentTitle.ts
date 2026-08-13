import { useEffect } from 'react';

const DEFAULT_TITLE = 'Mastra Factory';

/**
 * Sets `document.title` while mounted and restores the default on unmount.
 *
 * The title reverts as soon as the caller unmounts so navigating away from a
 * session-scoped page (e.g. back to the board) always lands back on the
 * static app title rather than the last session's headline.
 */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} | ${DEFAULT_TITLE}` : DEFAULT_TITLE;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
