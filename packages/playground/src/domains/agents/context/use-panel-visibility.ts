import { useContext } from 'react';
import { PanelVisibilityContext } from './panel-visibility-context';

export function usePanelVisibility() {
  const ctx = useContext(PanelVisibilityContext);
  if (!ctx) {
    throw new Error('usePanelVisibility must be used inside a <PanelVisibilityProvider>.');
  }
  return ctx;
}
