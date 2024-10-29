'use client';

import React, { FC } from 'react';

import { Dialog, DialogHeader, DialogContent, DialogTitle } from '@/components/ui/dialog';
import IconButton from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';

import { IntegrationButtonCodeSnippet } from './integration-button-code-snippet';
import { IntegrationLogo } from './integration-logo';

export type IntegrationButtonCodeSnippetDialogProps = {
  isOpen: boolean;
  onCancel: () => void;
  name: string;
  logoUrl: string;
  onOpenChange: () => void;
};

export const IntegrationButtonCodeSnippetDialog: FC<IntegrationButtonCodeSnippetDialogProps> = ({
  isOpen,
  onCancel,
  name,
  logoUrl,
  onOpenChange,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent overlay={true} className="px-0 pb-0 min-w-[650px]">
        <DialogHeader className="flex flex-row gap-[10px] items-center bg-[rgba(0_0_0_0.15)] px-5">
          <IntegrationLogo name={name} logoUrl={logoUrl} />
          <div className="flex flex-col">
            <DialogTitle asChild>
              <Text className="text-mastra-el-6 text-sm font-semibold">Add connection button inside your app</Text>
            </DialogTitle>
            <Text className="text-mastra-el-3" size="xs">
              Copy this code block to your server
            </Text>
          </div>

          <IconButton className="ml-auto" icon="cancel" onClick={onCancel} />
        </DialogHeader>

        <IntegrationButtonCodeSnippet
          name={name}
          className="integrations-screen-code-snippet"
          innerClassName="!w-[650px]"
        />
      </DialogContent>
    </Dialog>
  );
};
