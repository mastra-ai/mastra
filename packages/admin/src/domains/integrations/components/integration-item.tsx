import { zodResolver } from '@hookform/resolvers/zod';
import { DialogTitle } from '@radix-ui/react-dialog';
import { Separator } from '@radix-ui/react-dropdown-menu';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { addIntegrationAction, getCredentialAction } from '@/app/integrations/actions';
import { installPackage, isPackageInstalled } from '@/app/packages/actions';
import { CredentialInfo } from '@/domains/integrations/types';

import { pkgManagerToCommandMap } from './create-integration-client-layout';

const formSchema = z.object({
  clientID: z.string().min(1, 'Required'),
  clientSecret: z.string().min(1, 'Required'),
});

type IntegrationItemProps = {
  integration: { name: string; package: string; url: string };
  updatePkgManager: () => Promise<void>;
  packageManager: keyof typeof pkgManagerToCommandMap;
};

export function IntegrationItem({ integration, updatePkgManager, packageManager }: IntegrationItemProps) {
  const [integrationPkg, setIntegrationPkg] = React.useState({
    name: '',
    isInstalled: false,
  });

  const [integrationClientCredential, setIntegrationClientCredential] = React.useState<
    CredentialInfo & { integrationName: string }
  >({
    integrationName: '',
    clientID: '',
    clientSecret: '',
  });

  const defaultValues = {
    clientID: integrationClientCredential.clientID,
    clientSecret: integrationClientCredential.clientSecret,
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const handleDialog = async (name: string, integrationPackage: string) => {
    // TODO Get packageName
    setIntegrationPkg(prev => ({
      ...prev,
      packageName: integrationPackage,
      packageInstalled: false,
    }));

    if (await isPackageInstalled({ packageName: integrationPackage })) {
      setIntegrationPkg(prev => ({
        ...prev,
        packageName: integrationPackage,
        packageInstalled: true,
      }));
    } else {
      updatePkgManager();
    }

    const { clientID, clientSecret } = await getCredentialAction({ integrationName: name });

    setIntegrationClientCredential({
      clientID: clientID || '',
      clientSecret: clientSecret || '',
      integrationName: name,
    });

    form.reset({
      clientID: clientID || '',
      clientSecret: clientSecret || '',
    });
  };

  const router = useRouter();

  const handleInstallPackage = async (packageName: string) => {
    await installPackage({ packageName });

    setIntegrationPkg(prev => ({
      ...prev,
      name: packageName,
      isInstalled: true,
    }));
  };

  const onSubmit = async (credential: CredentialInfo) => {
    try {
      await addIntegrationAction({ integrationName: integrationClientCredential.integrationName, credential });
      router.push('/integrations');
    } catch (err) {
      // fail silently
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild key={integration.name}>
        <button
          onClick={() => handleDialog(integration.name, integration.package)}
          className="hover:bg-arkw-bg-4/50 p-3 rounded flex gap-3 items-center transition-colors duration-150"
          key={integration.name}
        >
          <Image src={`/images/integrations/${integration.url}`} width={28} height={28} alt={integration.name} />
          <span>{integration.name}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="p-0 gap-0">
        <VisuallyHidden.Root>
          <DialogTitle>Integration {integrationClientCredential.integrationName}</DialogTitle>
        </VisuallyHidden.Root>
        {!integrationPkg?.isInstalled ? (
          <div className="p-3 flex gap-3 flex-col">
            <p>You need to install this integration in your application.</p>
            <pre className="bg-arkw-bg-3 border-[0.5px] border-arkw-border-primary p-2 rounded font-mono text-sm">
              <code>
                <span className="font-medium"> {packageManager}</span>{' '}
                <span className="text-arkw-el-3">
                  {pkgManagerToCommandMap[packageManager]} {integration.package}
                </span>
              </code>
            </pre>

            <Button onClick={() => handleInstallPackage(integrationPkg?.name)} className="mt-3 w-full">
              Install Package
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-3 p-3 items-center">
              <Image
                src={`/images/integrations/${integrationClientCredential.integrationName.toLowerCase()}.svg`}
                width={40}
                height={40}
                alt={integrationClientCredential.integrationName}
              />

              <div>
                <p className="font-bold">{integrationClientCredential.integrationName}</p>
                <p className="text-arkw-el-3 text-sm">
                  Setup {integrationClientCredential.integrationName} integration
                </p>
              </div>
            </div>
            <Separator className="border-[0.5px] border-arkw-border-primary" />
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
