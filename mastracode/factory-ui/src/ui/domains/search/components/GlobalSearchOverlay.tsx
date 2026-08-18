import { useEffect, useRef } from 'react';

import { useKeyDown } from '../../../lib/hooks/useKeyDown';
import { useGlobalSearchControls } from '../hooks/useGlobalSearchControls';
import { restoreGlobalSearchTriggerFocus } from '../services/searchTriggerFocus';
import { GlobalSearchDialog } from './GlobalSearchDialog';

export function GlobalSearchOverlay() {
  const { isSearchOpen, openSearch, closeSearch } = useGlobalSearchControls();
  const wasSearchOpen = useRef(false);

  useKeyDown({
    'mod+k': event => {
      event.preventDefault();
      openSearch();
    },
  });

  useEffect(() => {
    if (wasSearchOpen.current && !isSearchOpen) restoreGlobalSearchTriggerFocus();
    wasSearchOpen.current = isSearchOpen;
  }, [isSearchOpen]);

  if (!isSearchOpen) return null;
  return <GlobalSearchDialog closeSearch={closeSearch} />;
}
