import type { ReactNode } from 'react';
import { PageHeaderRow } from '../PageLayout/page-header-row';
import { cn } from '@/lib/utils';

export interface MainContentLayoutProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Left side of the page header row. */
  breadcrumbs?: ReactNode;
  /** Right side of the page header row. */
  actions?: ReactNode;
  /** Visually hidden page `<h1>` for screen readers. */
  heading?: string;
}

export function MainContentLayout({
  children,
  className,
  style,
  breadcrumbs,
  actions,
  heading,
}: MainContentLayoutProps) {
  const devStyleRequested = devUIStyleRequested('MainContentLayout');

  return (
    <div data-slot="page-layout" className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      {(breadcrumbs || actions) && <PageHeaderRow breadcrumbs={breadcrumbs} actions={actions} />}
      <main
        className={cn(`grid h-full min-h-0 grid-rows-[auto_1fr] content-start items-start`, className)}
        style={{ ...style, ...(devStyleRequested ? { border: '3px dotted red' } : {}) }}
      >
        {heading && <h1 className="sr-only">{heading}</h1>}
        {children}
      </main>
    </div>
  );
}

export type MainContentContentProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  // content is centered in the middle of the page e.g. for empty state
  isCentered?: boolean;
  // content is split into two columns equal width columns
  isDivided?: boolean;
  // used when the left column is a service column (e.g. agent history nav)
  hasLeftServiceColumn?: boolean;
};

export function MainContentContent({
  children,
  className,
  isCentered = false,
  isDivided = false,
  hasLeftServiceColumn = false,
  style,
}: MainContentContentProps) {
  const devStyleRequested = devUIStyleRequested('MainContentContent');
  const contentClassName = getMainContentContentClassName({ isCentered, isDivided, hasLeftServiceColumn, className });

  return (
    <div
      className={contentClassName}
      style={{ ...style, ...(devStyleRequested ? { border: '3px dotted orange' } : {}) }}
    >
      {children}
    </div>
  );
}

export type GetMainContentContentClassNameArgs = {
  isCentered: boolean;
  isDivided: boolean;
  hasLeftServiceColumn: boolean;
  className?: string;
};

const getMainContentContentClassName = ({
  isCentered,
  isDivided,
  hasLeftServiceColumn,
  className,
}: GetMainContentContentClassNameArgs) => {
  return cn(
    `grid h-full overflow-y-auto `,
    `min-w-min overflow-x-auto`,
    {
      'items-start content-start': !isCentered && !isDivided && !hasLeftServiceColumn,
      'grid place-items-center': isCentered,
      'grid-cols-[1fr_1fr]': isDivided && !hasLeftServiceColumn,
      'grid-cols-[12rem_1fr_1fr]': isDivided && hasLeftServiceColumn,
      'grid-cols-[auto_1fr]': !isDivided && hasLeftServiceColumn,
    },
    className,
  );
};

function devUIStyleRequested(name: string) {
  try {
    const raw = localStorage.getItem('add-dev-style-to-components');
    if (!raw) return false;

    const components = raw
      .split(',')
      .map(c => c.trim())
      .filter(Boolean); // remove empty strings

    return components.includes(name);
  } catch (error) {
    console.error('Error reading or parsing localStorage:', error);
    return false;
  }
}
