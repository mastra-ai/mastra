'use client';

import React from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { DialogClose } from '@/components/ui/dialog';

import { Icon } from '@/app/components/icon';

interface IntegrationInstallModalContentProps {
  packageManager: string;
  snippet: string;
  integrationPkg: { name: string; isInstalled: boolean };
  handleInstallPackage: (packageName: string) => Promise<boolean>;
  isOnboarding?: boolean;
}
export const IntegrationInstallModalContent = ({
  packageManager,
  snippet,
  integrationPkg,
  handleInstallPackage,
  isOnboarding,
}: IntegrationInstallModalContentProps) => {
  const router = useRouter();

  const installPackage = async () => {
    handleInstallPackage(integrationPkg.name);
    if (isOnboarding) {
      router.push(`/setup?package=${integrationPkg.name} `);
    }
  };

  return (
    <div className="relative">
      <DialogClose className="absolute right-2 top-2">
        <Icon name="cancel" />
      </DialogClose>
      <div className="p-3 mt-1.5 flex gap-3 flex-col">
        <p>You need to install this integration in your application.</p>
        <pre className="bg-mastra-bg-3 flex items-center justify-between border-[0.5px] border-mastra-border-primary p-2 rounded font-mono text-sm">
          <code>
            <span className="font-medium"> {packageManager}</span> <span className="text-mastra-el-3">{snippet}</span>
          </code>
          <CopyButton snippet={packageManager + ' ' + snippet} />
        </pre>

        <Button onClick={installPackage} className="mt-3 w-full">
          {/* <Button onClick={() => handleInstallPackage(integrationPkg.name)} className="mt-3 w-full"> */}
          Install Package
        </Button>
      </div>
    </div>
  );
};
