'use client';

import { useSearchParams } from 'next/navigation';

import Breadcrumb from '@/components/ui/breadcrumbs';

import { toTitleCase } from '@/lib/string';

export function PlaygroundBreadCrumb() {
  const event = useSearchParams().get('name');

  return (
    <Breadcrumb
      items={[
        {
          label: 'Playground',
          href: `/playground`,
          isCurrent: false,
        },
        {
          label: toTitleCase(event || '', '_'),
          href: ` `,
          isCurrent: true,
        },
      ]}
      pageClassName="whitespace-nowrap"
    />
  );
}
