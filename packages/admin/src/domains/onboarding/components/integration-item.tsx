'use client';

import React from 'react';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { Dialog, DialogContent } from '@/components/ui/dialog';

import { IntegrationInstallModalContent } from '@/domains/integrations/components/integration-install-modal-content';
import { IntegrationPackage } from '@/domains/integrations/types';
import { useInstallPackage } from '@/hooks/use-install-package';
import { pkgManagerToCommandMap, usePackageManager } from '@/hooks/use-package-manager';

interface IntegrationItemProps {
  integration: IntegrationPackage;
}

export const IntegrationItem = ({ integration }: IntegrationItemProps) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const { packageManager, updatePackageManager } = usePackageManager();
  const { integrationPkg, handleInstallPackage } = useInstallPackage({
    packageName: integration.packageName,
    updatePkgManager: updatePackageManager,
  });
  const snippet = `${pkgManagerToCommandMap[packageManager]} ${integration.packageName}`;

  const handleIntegration = () => {
    if (!integrationPkg.isInstalled) {
      setIsOpen(true);
      return;
    }

    const lowercasedIntegrationName = integration.name.toLowerCase();
    if (integration.authType === 'OAUTH') {
      return router.push(`/setup/${lowercasedIntegrationName}`);
    }
    router.push(`/setup/${lowercasedIntegrationName}/connect`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <button
        onClick={handleIntegration}
        className="flex w-full items-center bg-white/[0.03] hover:bg-white/[0.05] transition-colors duration-150 rounded-[6px] gap-1.5"
      >
        <div className="w-[32px] h-[32px] m-1.5">
          <Image className="object-contain" src={integration.logoUrl} alt={integration.name} width={32} height={32} />
        </div>
        <div>
          <h3 className="text-[13px] font-medium text-kpl-el-5">{integration.name}</h3>
          {/* <p className="text-[10px] font-medium mt-0.5 text-kpl-el-2">Your email and calendar</p> */}
        </div>
      </button>

      <DialogContent>
        <IntegrationInstallModalContent
          integrationPkg={integrationPkg}
          handleInstallPackage={handleInstallPackage}
          packageManager={packageManager}
          snippet={snippet}
        />
      </DialogContent>
    </Dialog>
  );
};
