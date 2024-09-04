import React from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';

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
  return (
    <div className="p-3 flex gap-3 flex-col">
      <p>You need to install this integration in your application.</p>
      <pre className="bg-arkw-bg-3 flex items-center justify-between border-[0.5px] border-arkw-border-primary p-2 rounded font-mono text-sm">
        <code>
          <span className="font-medium"> {packageManager}</span> <span className="text-arkw-el-3">{snippet}</span>
        </code>
        <CopyButton snippet={packageManager + ' ' + snippet} />
      </pre>

      <Button onClick={() => handleInstallPackage(integrationPkg.name)} className="mt-3 w-full">
        Install Package
      </Button>
    </div>
  );
};
