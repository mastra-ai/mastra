import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode, Ref } from 'react';
import { useLocation } from 'react-router';

const PAGE_TITLES: Record<string, string> = {
  audit: 'Audit log',
  knowledge: 'Knowledge',
  new: 'New session',
  'new-factory': 'New factory',
  overview: 'Overview',
  review: 'Review',
  rules: 'Rules',
  work: 'Work',
};

function routeTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const page = segments.at(-1);

  if (page && PAGE_TITLES[page]) return PAGE_TITLES[page];
  if (segments.includes('threads')) return 'Session';
  if (segments.includes('workspaces') || segments.includes('user')) return 'New session';
  return 'Factory';
}

export function MobilePageTitle({
  children,
  ref,
  tabIndex,
}: {
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
  tabIndex?: number;
}) {
  const { pathname } = useLocation();

  return (
    <Txt as="h1" variant="header-sm" ref={ref} tabIndex={tabIndex} className="text-icon6 min-w-0 truncate md:hidden">
      {children ?? routeTitle(pathname)}
    </Txt>
  );
}
