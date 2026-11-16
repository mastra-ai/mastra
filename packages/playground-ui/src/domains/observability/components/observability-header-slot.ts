import { createContext, useContext } from 'react';

/**
 * The element at the end of the shared observability header row, next to the traces / spans / threads
 * switch. Controls rendered deep in a page body (e.g. saved views) portal into it.
 */
export const ObservabilityHeaderSlotContext = createContext<HTMLElement | undefined>(undefined);

export const useObservabilityHeaderSlot = () => useContext(ObservabilityHeaderSlotContext);
