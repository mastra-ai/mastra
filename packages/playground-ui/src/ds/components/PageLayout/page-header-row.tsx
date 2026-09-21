import type { ReactNode } from 'react';
import { Header } from '../Header';

export function PageHeaderRow({ breadcrumbs, actions }: { breadcrumbs?: ReactNode; actions?: ReactNode }) {
  return (
    <Header className="h-10 min-h-10 gap-2 overflow-hidden px-2">
      {breadcrumbs}
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2 overflow-hidden">{actions}</div>}
    </Header>
  );
}
