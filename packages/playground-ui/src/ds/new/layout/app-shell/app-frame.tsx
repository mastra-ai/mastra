import { AppShell } from './app-shell';
import type { AppShellProps } from './app-shell';
import { MainCard } from './main-card';

type AppFrameProps = Pick<AppShellProps, 'children' | 'sidebar' | 'mobileHeader' | 'edgeToEdge'>;

export function AppFrame({ children, sidebar, mobileHeader, edgeToEdge }: AppFrameProps) {
  return (
    <AppShell sidebar={sidebar} mobileHeader={mobileHeader} edgeToEdge={edgeToEdge}>
      <MainCard className="flex flex-col" edgeToEdge={edgeToEdge}>
        {children}
      </MainCard>
    </AppShell>
  );
}
