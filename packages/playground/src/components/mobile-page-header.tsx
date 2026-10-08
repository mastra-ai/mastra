import type { PageLayoutHeaderProps } from '@mastra/playground-ui/components/PageLayout';
import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { MobileHeaderContext } from './mobile-header-context';
import { MobilePageActions } from './mobile-page-actions';

/** Portal the original route-owned controls so entity context and permissions stay intact. */
export function MobilePageHeader({ breadcrumbs, headerActions, primaryActions }: PageLayoutHeaderProps) {
  const slots = useContext(MobileHeaderContext);
  if (!slots) return null;
  return createPortal(
    <>
      {breadcrumbs}
      {headerActions && <MobilePageActions>{headerActions}</MobilePageActions>}
      {primaryActions && <div className="flex shrink-0 items-center">{primaryActions}</div>}
    </>,
    slots.page,
  );
}
