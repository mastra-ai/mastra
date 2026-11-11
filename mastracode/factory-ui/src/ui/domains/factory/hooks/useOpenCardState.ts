import { useState } from 'react';

import type { BoardOpenCard } from '../context/BoardOpenCardContext';

/** Which board card has its details open; closing a card only clears it while it is still the open one. */
export function useOpenCardState(): BoardOpenCard {
  const [openKey, setOpenKey] = useState<string>();

  return {
    openKey,
    setCardOpen: (key, open) => setOpenKey(current => (open ? key : current === key ? undefined : current)),
  };
}
