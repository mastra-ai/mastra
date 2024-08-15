'use client';

import React from 'react';

import { useRouter } from 'next/navigation';

import Breadcrumb from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';

import { Icon } from '@/app/components/icon';

export const PluginHeader = () => {
  const router = useRouter();

  const handleCreatePlugins = () => {
    router.push('/plugins/create');
  };

  return (
    <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-primary-border px-[1.31rem]">
      <div className="inline-flex h-[26px] w-[125px] items-center justify-start gap-3">
        <Breadcrumb
          items={[
            {
              label: 'Plugins',
              href: ``,
              isCurrent: true,
            },
          ]}
          pageClassName="font-medium"
        />
      </div>

      <Button size="xs" variant="outline" className="flex gap-2" onClick={handleCreatePlugins}>
        <Icon name="plus-icon" className="text-current" />
        <span className="text-xs">Configure plugins</span>
      </Button>
    </div>
  );
};
