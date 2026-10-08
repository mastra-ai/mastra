import { Txt } from '@mastra/playground-ui/components/Txt';
import { useContext } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MobileHeaderContext } from './mobile-header-context';
import { ContextualNavigationDrawer } from './ui/contextual-navigation-drawer';

export function MobileFeatureNavigation({ label, children }: { label: string; children: ReactNode }) {
  const slots = useContext(MobileHeaderContext);
  if (slots)
    return createPortal(
      <div className="relative size-10 [&>button]:static [&>button]:size-10">
        <ContextualNavigationDrawer label={label}>{children}</ContextualNavigationDrawer>
      </div>,
      slots.navigation,
    );
  return (
    <div className="relative flex h-10 shrink-0 items-center border-b border-surface-rim pl-11">
      <ContextualNavigationDrawer label={label}>{children}</ContextualNavigationDrawer>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
    </div>
  );
}
