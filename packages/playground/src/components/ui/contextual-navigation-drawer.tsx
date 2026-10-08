import { PanelDrawer } from '@mastra/playground-ui/resize/panel-drawer';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

/** Selecting a destination closes the mobile drawer without resetting desktop navigation. */
export function ContextualNavigationDrawer({ label, children }: { label: string; children: ReactNode }) {
  const { pathname, search } = useLocation();
  const selectedFile = new URLSearchParams(search).get('file') ?? '';
  return (
    <PanelDrawer key={`${pathname}:${selectedFile}`} direction="left" label={label}>
      {children}
    </PanelDrawer>
  );
}
