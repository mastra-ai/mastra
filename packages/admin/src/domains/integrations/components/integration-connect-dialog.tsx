'use client';

import React, { FC } from 'react';
import { useForm } from 'react-hook-form';

import { DynamicForm } from '@/components/dynamic-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';

export type IntegrationConnectDialogProps = {
  isOpen: boolean;
  connectOptions: Record<string, any>; // Should be a JSON schema
  onCancel: () => void;
  onConnect: (credential: unknown) => void;
};

export const IntegrationConnectDialog: FC<IntegrationConnectDialogProps> = ({
  isOpen,
  connectOptions,
  onCancel,
  onConnect,
}) => {
  const form = useForm({});

  const onSubmit = (data: unknown) => {
    onConnect(data);
    form.reset();
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent overlay={true} className="px-7">
        <DialogHeader>
          <DialogTitle asChild>
            <Text className="pt-4 font-medium text-sm">Connect Integration</Text>
          </DialogTitle>
        </DialogHeader>

        <DynamicForm jsonSchema={connectOptions} form={form} onSubmit={onSubmit} />
        <DialogFooter>
          <div className="flex gap-3">
            <Button
              className="h-[31px] bg-[#424242] text-xs text-white"
              variant="default"
              size="sm"
              onClick={() => {
                form.reset();
                onCancel();
              }}
            >
              Cancel
            </Button>
            <Button
              className="h-[31px] text-xs"
              size="sm"
              disabled={!form.formState.isValid}
              onClick={form.handleSubmit(onSubmit)}
            >
              Connect
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
