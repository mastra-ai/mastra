'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { DialogTitle } from '@radix-ui/react-dialog';
import { Separator } from '@radix-ui/react-dropdown-menu';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import Breadcrumb from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { Icon } from '@/app/components/icon';
import { addIntegrationAction, getCredentialAction } from '@/app/integrations/actions';
import { isPackageInstalled, installPackage, getPackageManager } from '@/app/packages/actions';
import { CredentialInfo } from '@/domains/integrations/types';

const formSchema = z.object({
  clientID: z.string().min(1, 'Required'),
  clientSecret: z.string().min(1, 'Required'),
});

const pkgManagerToCommandMap = {
  npm: 'install',
  yarn: 'add',
  pnpm: 'add',
};

type PkgManagers = keyof typeof pkgManagerToCommandMap;

export const CreateIntegrationClientLayout = () => {
  const router = useRouter();
  const [packageInstalled, setPackageInstalled] = React.useState<boolean>(false);
  const [packageManager, setPackageManager] = React.useState<PkgManagers>('npm');
  const [packageName, setPackageName] = React.useState<string>('');
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
  const [searchTerm, setSearchTerm] = React.useState('');
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const integrations = [
    {
      name: 'Google',
      package: '@arkw/google',
      url: '/google.svg',
    },
    {
      name: 'Notion',
      package: '@arkw/notion',
      url: '/notion.svg',
    },
    {
      name: 'Slack',
      package: '@arkw/slack',
      url: '/slack.svg',
    },
    {
      name: 'Rewatch',
      package: '@arkw/rewatch',
      url: '/rewatch.svg',
    },
    {
      name: 'Mailchimp',
      package: '@arkw/mailchimp',
      url: '/mailchimp.svg',
    },
  ];

  const filteredIntegrations = React.useMemo(
    () =>
      integrations.filter(int => {
        return int.name.toLowerCase().includes(searchTerm.toLowerCase());
      }),
    [searchTerm],
  );

  const handleDialog = async (name: string, integrationPackage: string) => {
    // TODO Get packageName
    setPackageName(integrationPackage);
    if (await isPackageInstalled({ packageName: integrationPackage })) {
      setPackageInstalled(true);
    } else {
      setPackageManager(await getPackageManager());
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

  const handleInstallPackage = async (packageName: string) => {
    await installPackage({ packageName });
    setPackageInstalled(true);
  };

  const onSubmit = async (credential: CredentialInfo) => {
    try {
      await addIntegrationAction({ integrationName: integrationClientCredential.integrationName, credential });
      setPackageInstalled(false);
      router.push('/integrations');
    } catch (err) {
      // fail silently
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0">
        <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-primary-border px-[1.31rem]">
          <div className="inline-flex h-[26px] w-[125px] items-center justify-start gap-3">
            <Breadcrumb
              items={[
                {
                  label: 'Create integration',
                  href: ``,
                  isCurrent: true,
                },
              ]}
              pageClassName="font-medium"
            />
          </div>
        </div>
      </div>
      <div className="px-3">
        <div className="my-6 relative">
          <Icon name="search" className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
          <Input
            className="bg-gray-400/5 px-9 py-3"
            placeholder="Search available integrations"
            value={searchTerm}
            onChange={handleInputChange}
          />
        </div>
        <Dialog>
          <div className="grid grid-cols-3 gap-y-3">
            {filteredIntegrations.map(integration => {
              return (
                <DialogTrigger asChild key={integration.name}>
                  <button
                    onClick={() => handleDialog(integration.name, integration.package)}
                    className="hover:bg-arkw-bg-4/50 p-3 rounded flex gap-3 items-center transition-colors duration-150"
                    key={integration.name}
                  >
                    <Image
                      src={`/images/integrations/${integration.url}`}
                      width={28}
                      height={28}
                      alt={integration.name}
                    />
                    <span>{integration.name}</span>
                  </button>
                </DialogTrigger>
              );
            })}
          </div>
          <DialogContent className="p-0 gap-0">
            <VisuallyHidden.Root>
              <DialogTitle>Integration {integrationClientCredential.integrationName}</DialogTitle>
            </VisuallyHidden.Root>
            {!packageInstalled ? (
              <div className="p-3 flex gap-3 flex-col">
                <p>You need to install this integration in your application.</p>
                <pre className="bg-arkw-bg-3 border-[0.5px] border-arkw-border-primary p-2 rounded font-mono text-sm">
                  <code>
                    <span className="font-medium"> {packageManager}</span>{' '}
                    <span className="text-arkw-el-3">
                      {pkgManagerToCommandMap[packageManager]} {packageName}
                    </span>
                  </code>
                </pre>

                <Button onClick={() => handleInstallPackage(packageName)} className="mt-3 w-full">
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
                        <Button
                          className="h-8 px-4 rounded"
                          onClick={() => form.reset(defaultValues)}
                          variant="destructive"
                          type="button"
                        >
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
      </div>
    </div>
  );
};
