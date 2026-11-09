/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';

// Why: a compact trigger (e.g. a crumb's chevron switcher) is a small part of what it switches.
// The wrapper publishes its own element so the popup lines up with the whole thing, not the chevron.
const PopupAnchorContext = React.createContext<React.RefObject<HTMLElement | null> | undefined>(undefined);

export const PopupAnchorProvider = PopupAnchorContext.Provider;

/** The element popups inside a `PopupAnchorProvider` position against, if any. */
export function usePopupAnchor() {
  return React.useContext(PopupAnchorContext);
}
