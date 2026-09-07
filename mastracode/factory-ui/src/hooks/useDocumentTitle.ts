import { useEffect } from 'react';

const DEFAULT_TITLE = 'Mastra Factory';

/** Unmount restores the default, so leaving a session never strands its headline on the board. */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} | ${DEFAULT_TITLE}` : DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
