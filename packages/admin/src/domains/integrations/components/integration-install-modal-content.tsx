import React from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { DialogClose } from '@/components/ui/dialog';

import { Icon } from '@/app/components/icon';

interface IntegrationInstallModalContentProps {
  packageManager: string;
  snippet: string;
  integrationPkg: { name: string; isInstalled: boolean };
  handleInstallPackage: (packageName: string) => void;
}
export const IntegrationInstallModalContent = ({
  packageManager,
  snippet,
  integrationPkg,
  handleInstallPackage,
}: IntegrationInstallModalContentProps) => {
  // TODO: check every few seconds if the package is installed
  return (
    <div className="relative">
      <DialogClose className="absolute right-2 top-0">
        <Icon name="cancel" />
      </DialogClose>
      <div className="p-3 mt-1.5 flex gap-3 flex-col">
        <p>You need to install this integration in your application.</p>
        <pre className="bg-kp-bg-3 flex items-center justify-between border-[0.5px] border-kp-border-primary p-2 rounded font-mono text-sm">
          <code>
            <span className="font-medium"> {packageManager}</span> <span className="text-kp-el-3">{snippet}</span>
          </code>
          <CopyButton snippet={packageManager + ' ' + snippet} />
        </pre>

        <Button onClick={() => handleInstallPackage(integrationPkg.name)} className="mt-3 w-full">
          Install Package
        </Button>
      </div>
    </div>
  );
};
