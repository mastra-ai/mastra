'use client';

import { ReactNode } from 'react';

import { usePathname } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';

import { useIntegrationDetails } from '../hooks/use-integration';

import { IntegrationLogo } from './integration-logo';

export const IndividualIntegrationHeader = ({ name, headerButton }: { name: string; headerButton?: ReactNode }) => {
  const pathname = usePathname();
  const [_, path, __] = pathname.split('/');

  const { integration, loading } = useIntegrationDetails({ name });

  if (loading) {
    return (
      <div className="flex h-[var(--top-bar-height)] w-full content-center items-center gap-[10px] border-b-[0.1px] border-kpl-border-1 px-[1.31rem]">
        <Skeleton className="w-[17.6px] h-[17.6px]" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  return (
    <div className="flex h-[var(--top-bar-height)] w-full content-center items-center gap-[10px] border-b-[0.1px] border-kpl-border-1 px-[1.31rem]">
      {integration ? (
        <>
          <IntegrationLogo
            name={integration.name}
            logoUrl={integration.logoUrl}
            withConnectionsDot={!!integration.connections?.length}
            imageSize={11}
          />
          <h1 className="text-xs text-kpl-el-6 font-medium capitalize">
            {name?.toLocaleLowerCase()} {path}
          </h1>
        </>
      ) : null}

      {headerButton}
    </div>
  );
};
