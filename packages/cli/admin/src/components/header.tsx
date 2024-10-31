'use client';

import Link from 'next/link';

import { Icon } from '@/components/icon';
import Breadcrumb from '@/components/ui/breadcrumbs';

export const Header = ({
  linkText,
  breadcrumbLabel,
  href,
  children,
  withDialog,
}: {
  linkText: string;
  breadcrumbLabel: string;
  href: string;
  withDialog?: boolean;
  children?: React.ReactNode;
}) => {
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

      {withDialog ? (
        children
      ) : (
        <Link
          href={href}
          className="flex cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 py-1 text-xs"
        >
          <Icon name="plus-icon" className="text-current" />
          <span className="text-xs">{linkText}</span>
        </Link>
      )}
    </div>
  );
};
