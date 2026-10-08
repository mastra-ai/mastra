import { useContext } from 'react';
import { Header } from '../Header';
import { PageLayoutHeaderContext } from './page-layout-header-context';
import type { PageLayoutHeaderProps } from './page-layout-header-context';

export function PageLayoutHeader({ breadcrumbs, headerActions, primaryActions }: PageLayoutHeaderProps) {
  const HeaderComponent = useContext(PageLayoutHeaderContext);
  if (HeaderComponent)
    return <HeaderComponent breadcrumbs={breadcrumbs} headerActions={headerActions} primaryActions={primaryActions} />;
  return (
    <Header className="h-10 min-h-10 shrink-0 gap-2 overflow-hidden px-2">
      {breadcrumbs}
      {(headerActions || primaryActions) && (
        <div className="ml-auto flex shrink-0 items-center gap-2 overflow-hidden">
          {headerActions}
          {primaryActions}
        </div>
      )}
    </Header>
  );
}
