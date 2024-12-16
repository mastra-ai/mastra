'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { DialogTitle } from '@radix-ui/react-dialog';
import { Separator } from '@radix-ui/react-dropdown-menu';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { Icon } from '@/components/icon';
import MultiSelect from '@/components/multi-select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import Spinner from '@/components/ui/spinner';

import { toTitleCase } from '@/lib/string';
import { toast } from '@/lib/toast';

import { addIntegrationAction, getCredentialAction } from '@/domains/integrations/actions';
import type { CredentialInfo, IntegrationPackage } from '@/domains/integrations/types';

import { useInstallPackage } from '../../../hooks/use-install-package';
import { pkgManagerToCommandMap } from '../../../hooks/use-package-manager';

import { IntegrationInstallModalContent } from './integration-install-modal-content';
import { IntegrationLogo } from './integration-logo';

const formSchema = z.object({
  clientID: z.string().min(1, 'Required'),
  clientSecret: z.string().min(1, 'Required'),
  scopes: z.string().array().optional(),
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
  const [isLoading, setIsLoading] = useState(false);
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
    setIsLoading(true);
    try {
      await addIntegrationAction({
        integrationName: integration.name,
        credential,
        isUserDefined: integration.isUserDefined,
      });
      toast.success('Integration Added', {
        position: 'bottom-center',
      });
      router.push('/integrations');
    } catch (err) {
      setIsLoading(false);
      toast.error('Could not add integration, try again', {
        position: 'bottom-center',
      });
    }
  };

  const snippet = `${pkgManagerToCommandMap[packageManager]} ${integration.packageName}`;

  const IntegrationButton = ({ onClick }: { onClick?: () => void }) => {
    return (
      <Button
        type="button"
        className="bg-mastra-bg-13 border-[0.5px] border-mastra-border-1 group hover:bg-[#292929] p-3 rounded flex gap-3 items-center transition-colors duration-150 h-[unset]"
        key={integration.name}
        onClick={onClick}
      >
        <IntegrationLogo logoUrl={integration.logoUrl} name={integration.name} imageSize={18} />
        <span className="capitalize text-xs text-mastra-el-6">{toTitleCase(integration.name, '_')}</span>
        <Icon name="book" className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto text-mastra-el-3" />
      </Button>
    );
  };

  const isShowInstallModal = !integrationPkg?.isInstalled && !integration.isUserDefined;

  return (
    <Dialog>
      {isApiKey ? (
        <IntegrationButton
          onClick={async () => {
            toast.promise({
              myPromise: async () => {
                await handleInstallPackage(integrationPkg.name);
                await addIntegrationAction({
                  integrationName: integration.name,
                  isUserDefined: integration.isUserDefined,
                });
                return 'done' as unknown;
              },
              loadingMessage: 'Adding integration...',
              successMessage: 'Added integration',
              errorMessage: 'Could not add integration, try again',
              options: {
                position: 'bottom-center',
              },
              onSuccess: () => {
                router.push('/integrations');
              },
            });
          }}
        />
      ) : (
        <DialogTrigger asChild key={integration.name}>
          <IntegrationButton />
        </DialogTrigger>
      )}
      <DialogContent className="p-0 gap-0">
        <VisuallyHidden.Root>
          <DialogTitle>Integration {integration.name}</DialogTitle>
        </VisuallyHidden.Root>
        {isShowInstallModal ? (
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
                <p className="font-bold">{toTitleCase(integration.name, '_')}</p>
                <p className="text-mastra-el-3 text-sm">Setup {toTitleCase(integration.name, '_')} integration</p>
              </div>
            </div>
            <Separator className="border-[0.5px] border-mastra-border-primary" />
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
                <FormField
                  control={form.control}
                  name={'scopes'}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scopes</FormLabel>
                      <MultiSelect
                        fieldName="Scope"
                        options={integration.availableScopes.map(scope => ({
                          label: `${scope.key} - ${scope.description}`,
                          value: scope.key,
                        }))}
                        onSelect={selected => {
                          form.setValue('scopes', selected.value);
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex space-x-3 text-sm items-center">
                  <Button type="submit" className="h-8 px-4 rounded">
                    {isLoading ? <Spinner className="w-3 h-3 mr-3" /> : null}
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
