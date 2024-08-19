'use client';

import React from 'react';

import { useRouter } from 'next/navigation';

import Breadcrumb from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';

import { Icon } from '@/app/components/icon';

export const IntegrationHeader = () => {
  const router = useRouter();

  const handleCreateIntegrations = () => {
    router.push('/integrations/create');
  };

  return (
    <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-primary-border px-[1.31rem]">
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

      <Button size="xs" variant="outline" className="flex gap-2" onClick={handleCreateIntegrations}>
        <Icon name="plus-icon" className="text-current" />
        <span className="text-xs">Configure integrations</span>
      </Button>
    </div>
  );
};
