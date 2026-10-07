import { Children, isValidElement } from 'react';
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

import { PageHeaderAction } from './page-header-action';
import { PageHeaderEyebrow } from './page-header-eyebrow';
import { PageHeaderIcon } from './page-header-icon';
import { PageHeaderMeta } from './page-header-meta';
import type { PageHeaderMetaProps } from './page-header-meta';
import { PageHeaderTitle } from './page-header-title';
import { cn } from '@/lib/utils';

export type PageHeaderRootProps = ComponentPropsWithoutRef<'header'> & {
  reserveTopSpace?: boolean;
};

function isSlot(child: ReactNode, type: ElementType) {
  return isValidElement(child) && child.type === type;
}

function isBesideMeta(child: ReactNode) {
  return isValidElement<PageHeaderMetaProps>(child) && child.type === PageHeaderMeta && Boolean(child.props.beside);
}

function groupSlots(items: ReactNode[]) {
  const eyebrows = items.filter(child => isSlot(child, PageHeaderEyebrow));
  const icons = items.filter(child => isSlot(child, PageHeaderIcon));
  const headline = [...items.filter(child => isSlot(child, PageHeaderTitle)), ...items.filter(isBesideMeta)];
  // Actions sit outside the title column so their height never affects title/meta/description alignment.
  const actions = items.filter(child => isSlot(child, PageHeaderAction));
  const placed = [...eyebrows, ...icons, ...headline, ...actions];
  const below = items.filter(child => !placed.includes(child));
  return { eyebrows, icons, headline, below, actions };
}

export function PageHeaderRoot({ children, className, reserveTopSpace = false, ...props }: PageHeaderRootProps) {
  const items = Children.toArray(children);
  const { eyebrows, icons, headline, below, actions } = groupSlots(items);
  const hasControls = icons.length > 0 || actions.length > 0;

  return (
    <header
      className={cn('relative flex w-full flex-col', !hasControls && 'gap-1', className, reserveTopSpace && 'pt-10')}
      data-reserve-top-space={reserveTopSpace || undefined}
      {...props}
    >
      {eyebrows}
      <div className="flex w-full items-start gap-3">
        {icons}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {headline.length > 0 && (
            <div className={cn('flex min-w-0 items-start gap-3', hasControls && 'py-1')}>{headline}</div>
          )}
          {below}
        </div>
        {actions}
      </div>
    </header>
  );
}
