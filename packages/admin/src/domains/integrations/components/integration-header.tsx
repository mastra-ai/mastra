'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Breadcrumb from '@/components/ui/breadcrumbs';

import { Icon } from '@/app/components/icon';

export const IntegrationHeader = () => {
  const router = useRouter();

  return (
    <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-kpl-border-1 px-[1.31rem]">
      <div className="inline-flex h-[26px] w-[125px] items-center justify-start gap-3">
        <Breadcrumb
          items={[
            {
              label: 'Integrations',
              href: ``,
              isCurrent: true,
            },
          ]}
          pageClassName="font-medium"
        />
      </div>

      <Link
        href="/integrations/create"
        className="flex rounded bg-kpl-bg-6 gap-2 border-[0.5px] border-kpl-border-1  px-2 py-1 text-xs"
        prefetch
      >
        <Icon name="plus-icon" className="text-current" />
        <span className="text-xs">Configure integrations</span>
      </Link>
    </div>
  );
};
