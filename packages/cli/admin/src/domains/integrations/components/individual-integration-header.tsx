'use client';

import { ReactNode } from 'react';

import { usePathname } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';

import { capitalizeFirstLetter } from '@/lib/string';

import { useIntegrationDetails } from '../hooks/use-integration';
import { entityTypeToLabelMap } from '../types';

import { IntegrationLogo } from './integration-logo';

export const IndividualIntegrationHeader = ({ name, headerButton }: { name: string; headerButton?: ReactNode }) => {
  const pathname = usePathname();
  const [_, path, __, entity] = pathname.split('/');

  const { integration, loading } = useIntegrationDetails({ name });

  const entityText = entity ? entityTypeToLabelMap[entity?.toUpperCase()] || capitalizeFirstLetter(entity) : '';

  const pathText =
    path === 'records' ? `${entityText}${entityText?.[entityText?.length - 1] === 's' ? '' : 's'}` : path;

  if (loading) {
    return (
      <div className="flex h-[var(--top-bar-height)] w-full content-center items-center gap-[10px] border-b-[0.1px] border-mastra-border-1 px-[1.31rem]">
        <Skeleton className="w-[17.6px] h-[17.6px]" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  return (
    <div className="flex h-[var(--top-bar-height)] w-full content-center items-center gap-[10px] border-b-[0.1px] border-mastra-border-1 px-[1.31rem]">
      {integration ? (
        <>
          <IntegrationLogo
            name={integration.name}
            logoUrl={integration.logoUrl}
            withConnectionsDot={!!integration.connections?.length}
            imageSize={11}
          />
          <h1 className="text-xs text-mastra-el-6 font-medium capitalize">
            {name?.toLocaleLowerCase()} {pathText}
          </h1>
        </>
      ) : null}

      {headerButton}
    </div>
  );
};
