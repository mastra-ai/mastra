'use client';

import React, { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { DialogClose } from '@/components/ui/dialog';
import Spinner from '@/components/ui/spinner';

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
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const installPackage = async () => {
    setIsLoading(true);
    await handleInstallPackage(integrationPkg.name);
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
          {isLoading ? <Spinner className="w-3 h-3 mr-3" /> : null}
          Install Package
        </Button>
      </div>
    </div>
  );
};
