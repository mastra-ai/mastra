import { useContext } from 'react';
import { PanelSizingContext } from './panel-sizing-context';

export function usePanelSizing() {
  const ctx = useContext(PanelSizingContext);
  if (!ctx) {
    throw new Error('usePanelSizing must be used inside a <PanelSizingProvider>.');
  }
  return ctx;
}
