'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Breadcrumb from '@/components/ui/breadcrumbs';

import { Icon } from '@/app/components/icon';

export const Header = ({
  linkText,
  breadcrumbLabel,
  href,
}: {
  linkText: string;
  breadcrumbLabel: string;
  href: string;
}) => {
  const router = useRouter();

  return (
    <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-mastra-border-1 px-[1.31rem]">
      <div className="inline-flex h-[26px] w-[125px] items-center justify-start gap-3">
        <Breadcrumb
          items={[
            {
              label: `${breadcrumbLabel}`,
              href: ``,
              isCurrent: true,
            },
          ]}
          pageClassName="font-medium"
        />
      </div>

      <Link
        href={href}
        className="flex rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 py-1 text-xs"
        prefetch
      >
        <Icon name="plus-icon" className="text-current" />
        <span className="text-xs">{linkText}</span>
      </Link>
    </div>
  );
};
