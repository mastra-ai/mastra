import { useEffect } from 'react';

const DEFAULT_TITLE = 'Mastra Factory';

export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    document.title = title ? `${title}: ${DEFAULT_TITLE}` : DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
