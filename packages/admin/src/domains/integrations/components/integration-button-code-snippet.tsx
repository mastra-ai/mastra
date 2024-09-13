'use client';

import React, { FC } from 'react';

import Image from 'next/image';

import { Dialog, DialogHeader, DialogContent } from '@/components/ui/dialog';
import IconButton from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';

import { capitalizeFirstLetter } from '@/lib/string';

import { CodeBlock } from './code-block';

export type IntegrationButtonCodeSnippetDialogProps = {
  isOpen: boolean;
  onCancel: () => void;
  name: string;
  logoUrl: string;
};

export const IntegrationButtonCodeSnippetDialog: FC<IntegrationButtonCodeSnippetDialogProps> = ({
  isOpen,
  onCancel,
  name,
  logoUrl,
}) => {
  const snippet = `
    import { config } from '@kpl/config';
    import { Framework } from '@kpl/core';

    export const ${name && capitalizeFirstLetter(name)}ConnectButton = () => {
      const framework = Framework.init(config);
      const OAuthConnectionRoute = framework?.makeConnectURI({
        clientRedirectPath: 'YOUR_REDIRECT_PATH',
        name: '${name}',
        referenceId: 'YOUR_REFERENCE_ID',
      });

      return (
        <a href={OAuthConnectionRoute}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-block"
        >
          Connect with ${name && capitalizeFirstLetter(name)}
        </a>
      );
    };
    `;

  return (
    <Dialog open={isOpen}>
      <DialogContent overlay={true} className="px-0 pb-0 min-w-[650px]">
        <DialogHeader className="flex flex-row gap-[10px] items-center bg-[rgba(0_0_0_0.15)] px-5">
          <Image src={logoUrl} alt={`${name} logo`} width={28} height={28} />
          <div className="flex flex-col">
            <Text className="text-kpl-el-6" weight="semibold" size="sm">
              Add connection button inside your app
            </Text>
            <Text className="text-kpl-el-3" size="xs">
              Copy this code block to your server
            </Text>
          </div>

          <IconButton className="ml-auto" icon="cancel" onClick={onCancel} />
        </DialogHeader>

        <CodeBlock snippet={snippet} className="integrations-screen-code-snippet" innerClassName="!w-[650px]" />
      </DialogContent>
    </Dialog>
  );
};
