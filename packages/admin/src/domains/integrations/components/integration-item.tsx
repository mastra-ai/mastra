import { zodResolver } from '@hookform/resolvers/zod';
import { DialogTitle } from '@radix-ui/react-dialog';
import { Separator } from '@radix-ui/react-dropdown-menu';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { toast } from '@/lib/toast';

import { addIntegrationAction, getCredentialAction } from '@/app/(dashboard)/integrations/actions';
import { Icon } from '@/app/components/icon';
import type { CredentialInfo, IntegrationPackage } from '@/domains/integrations/types';

import { useInstallPackage } from '../../../hooks/use-install-package';
import { pkgManagerToCommandMap } from '../../../hooks/use-package-manager';

import { IntegrationInstallModalContent } from './integration-install-modal-content';
import { IntegrationLogo } from './integration-logo';

const formSchema = z.object({
  clientID: z.string().min(1, 'Required'),
  clientSecret: z.string().min(1, 'Required'),
});

type IntegrationItemProps = {
  integration: IntegrationPackage;
  updatePkgManager: () => Promise<void>;
  packageManager: keyof typeof pkgManagerToCommandMap;
};

const defaultValues = {
  clientID: '',
  clientSecret: '',
};

export function IntegrationItem({ integration, updatePkgManager, packageManager }: IntegrationItemProps) {
  const { integrationPkg, handleInstallPackage, handlePackage } = useInstallPackage({
    packageName: integration.packageName,
    updatePkgManager,
  });
  const isApiKey = integration?.authType === 'API_KEY';

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const handleDialog = async (name: string, packageName: string) => {
    await handlePackage();

    const { clientID, clientSecret } = await getCredentialAction({ integrationName: name });

    form.setValue('clientID', clientID || '');
    form.setValue('clientSecret', clientSecret || '');
  };

  useEffect(() => {
    handleDialog(integration.name, integration.packageName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration]);

  const router = useRouter();

  const onSubmit = async (credential?: CredentialInfo) => {
    try {
      await addIntegrationAction({ integrationName: integration.name, credential });
      toast.success('Integration Added', {
        position: 'bottom-center',
      });
      router.push('/integrations');
    } catch (err) {
      toast.error('Could not add integration, try again', {
        position: 'bottom-center',
      });
    }
  };

  const snippet = `${pkgManagerToCommandMap[packageManager]} ${integration.packageName}`;

  const IntegrationButton = ({ onClick }: { onClick?: () => void }) => {
    return (
      <button
        type="button"
        className="bg-kpl-bg-13 border-[0.5px] border-kpl-border-1 group hover:bg-[#292929] p-3 rounded flex gap-3 items-center transition-colors duration-150"
        key={integration.name}
        onClick={onClick}
      >
        <IntegrationLogo logoUrl={integration.logoUrl} name={integration.name} />
        <span className="capitalize text-xs">{integration.name}</span>
        <Icon name="book" className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto text-kpl-el-3" />
      </button>
    );
  };

  return (
    <Dialog>
      {isApiKey ? (
        <IntegrationButton onClick={() => onSubmit()} />
      ) : (
        <DialogTrigger asChild key={integration.name}>
          <IntegrationButton />
        </DialogTrigger>
      )}
      <DialogContent className="p-0 gap-0">
        <VisuallyHidden.Root>
          <DialogTitle>Integration {integration.name}</DialogTitle>
        </VisuallyHidden.Root>
        {!integrationPkg?.isInstalled ? (
          <IntegrationInstallModalContent
            packageManager={packageManager}
            snippet={snippet}
            handleInstallPackage={handleInstallPackage}
            integrationPkg={integrationPkg}
          />
        ) : (
          <>
            <div className="flex gap-3 p-3 items-center">
              <Image src={integration.logoUrl} width={40} height={40} alt={integration.name} />

              <div>
                <p className="font-bold">{integration.name}</p>
                <p className="text-kpl-el-3 text-sm">Setup {integration.name} integration</p>
              </div>
            </div>
            <Separator className="border-[0.5px] border-kpl-border-primary" />
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-3">
                <FormField
                  control={form.control}
                  name="clientID"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client ID</FormLabel>
                      <FormControl>
                        <Input
                          className=" placeholder:text-sm"
                          placeholder="Find the Client ID on the developer portal of the external API provider"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Secret</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Find the Client Secret on the developer portal of the external API provider"
                          type="password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex space-x-3 text-sm items-center">
                  <Button type="submit" className="h-8 px-4 rounded">
                    Save
                  </Button>
                  <DialogClose asChild>
                    <Button className="h-8 px-4 rounded" variant="destructive" type="button">
                      Cancel
                    </Button>
                  </DialogClose>
                </div>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
