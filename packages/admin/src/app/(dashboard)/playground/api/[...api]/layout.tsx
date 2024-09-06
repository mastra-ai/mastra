import { ReactNode } from 'react';

import Breadcrumb from '@/components/ui/breadcrumbs';

import { toTitleCase } from '@/lib/string';

export default function Layout({ params, children }: { children: ReactNode; params: { api: Array<string> } }) {
  const [_, apiName] = params.api;
  return (
    <div>
      <nav className="text-sm h-fit capitalize border-b-[0.5px] py-2 border-arkw-border-1 p-4">
        <Breadcrumb
          items={[
            {
              label: 'Playground',
              href: `/playground`,
              isCurrent: false,
            },
            {
              label: toTitleCase(apiName, '_'),
              href: ` `,
              isCurrent: true,
            },
          ]}
          pageClassName="whitespace-nowrap"
        />
      </nav>
      <section className="p-[0.62rem] bg-arkw-bg-1 h-[calc(100%-1.24rem)]">{children}</section>
    </div>
  );
}
