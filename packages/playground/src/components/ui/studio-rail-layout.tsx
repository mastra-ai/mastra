import type { ReactNode } from 'react';

/** Pure positioning keeps rail chrome independent of navigation data. */
export function StudioRailLayout({
  header,
  navigation,
  footer,
}: {
  header: ReactNode;
  navigation: ReactNode;
  footer: ReactNode;
}) {
  return (
    <aside
      aria-label="Studio navigation"
      className="hidden h-full min-h-0 w-12 flex-col px-0.5 lg:flex [&_li>a]:mx-auto [&_li>a]:size-10 [&_li>a]:justify-center [&_li>a]:rounded-md [&_li>a]:p-0 [&_li>button]:mx-auto [&_li>button]:size-10 [&_li>button]:justify-center [&_li>button]:rounded-md [&_li>button]:p-0"
    >
      {header}
      {navigation}
      {footer}
    </aside>
  );
}
