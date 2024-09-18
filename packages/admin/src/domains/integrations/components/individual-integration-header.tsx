'use client';

import { ReactNode } from 'react';

import { usePathname } from 'next/navigation';

import { IntegrationLogo } from './integration-logo';

export const IndividualIntegrationHeader = ({
  name,
  logoUrl,
  connections,
  headerButton,
}: {
  name: string;
  logoUrl: string;
  connections: number;
  headerButton: ReactNode;
}) => {
  const pathname = usePathname();
  const [_, path, __] = pathname.split('/');

  return (
    <div className="flex h-[var(--top-bar-height)] w-full content-center items-center gap-[10px] border-b-[0.1px] border-kpl-border-1 px-[1.31rem]">
      <IntegrationLogo name={name} logoUrl={logoUrl} withConnectionsDot={!!connections} imageSize={11} />
      <h1 className="text-xs text-kpl-el-6 font-medium capitalize">
        {name?.toLocaleLowerCase()} {path}
      </h1>

      {headerButton}
    </div>
  );
};
