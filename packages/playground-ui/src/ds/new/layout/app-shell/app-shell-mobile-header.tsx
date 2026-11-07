import type { AppShellMobileBar } from './app-shell-mobile-bar-context';
import { Header } from '@/ds/components/Header';
import { SidebarMobileTrigger } from '@/ds/components/Sidebar/root/sidebar-mobile-trigger';
import { frameFillStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export function AppShellMobileHeader({ brand, actions }: AppShellMobileBar) {
  return (
    <Header className={cn('min-h-header-default shrink-0 gap-2 overflow-hidden px-2', frameFillStyle)}>
      <SidebarMobileTrigger className="shrink-0" />
      {brand}
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </Header>
  );
}
