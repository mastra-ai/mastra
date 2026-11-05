import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Field, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { toast } from '@mastra/playground-ui/components/Toaster';
import {
  headlessAuthFieldKey,
  headlessAuthFields,
  splitHeadlessAuthValues,
} from '@mastra/playground-ui/domains/connect/headless-connect';
import type { UserConnectAuthField } from '@mastra/playground-ui/domains/connect/types';
import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  useConnectPlatformProviderMutation,
  useReconnectPlatformProviderMutation,
} from '../../../../hooks/usePlatformConnections';
import type {
  HeadlessAuthInput,
  PlatformConnectProvider,
  PlatformProviderConnection,
} from '../../factory/services/platformConnect';

export function connectionName(connection: PlatformProviderConnection): string {
  return connection.displayName?.trim() || connection.accountLabel?.trim() || 'Connected account';
}

interface AuthFieldsDialogProps {
  provider: PlatformConnectProvider;
  fields: UserConnectAuthField[];
  title: string;
  pending: boolean;
  onSubmit: (values: Record<string, string>) => void;
  onClose: () => void;
}

function AuthFieldsDialog({ provider, fields, title, pending, onSubmit, onClose }: AuthFieldsDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const trimmed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
  const complete = fields.every(field => !field.required || trimmed[headlessAuthFieldKey(field)]);
  return (
    <Dialog open onOpenChange={open => !open && onClose()} pending={pending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {fields.some(field => field.secret) && (
            <DialogDescription>
              Secrets are stored by Mastra Platform and never reach the browser again.
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {fields.map(field => {
            const key = headlessAuthFieldKey(field);
            const label = field.label || field.name;
            return (
              <Field key={key}>
                <FieldLabel required={!!field.required}>{label}</FieldLabel>
                <Input
                  aria-label={`${provider.displayName} ${label}`}
                  type={field.secret ? 'password' : 'text'}
                  placeholder={field.placeholder ?? undefined}
                  value={values[key] ?? ''}
                  onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))}
                />
                {field.description && <FieldDescription>{field.description}</FieldDescription>}
              </Field>
            );
          })}
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={!complete} onConfirm={() => onSubmit(trimmed)}>
            {pending ? 'Connecting…' : 'Connect'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface ProviderConnectControlProps {
  provider: PlatformConnectProvider;
  reconnectConnectionId?: string;
  label: string;
  buttonLabel?: string;
  size?: 'sm' | 'md';
  variant?: 'default' | 'ghost' | 'primary';
  icon?: ReactNode;
  className?: string;
  onCompleted?: () => void;
}

export function ProviderConnectControl({
  provider,
  reconnectConnectionId,
  label,
  buttonLabel,
  size = 'sm',
  variant = 'default',
  icon,
  className,
  onCompleted,
}: ProviderConnectControlProps) {
  const connectMutation = useConnectPlatformProviderMutation(provider.id);
  const reconnectMutation = useReconnectPlatformProviderMutation(provider.id);
  const [collectingFields, setCollectingFields] = useState(false);
  const pending = connectMutation.isPending || reconnectMutation.isPending;
  const fields = headlessAuthFields(provider);

  const run = async (values: Record<string, string>) => {
    const auth: HeadlessAuthInput = { authType: provider.authType, ...splitHeadlessAuthValues(fields, values) };
    try {
      const connection = reconnectConnectionId
        ? await reconnectMutation.mutateAsync({ connectionId: reconnectConnectionId, ...auth })
        : await connectMutation.mutateAsync(auth);
      setCollectingFields(false);
      if (connection) {
        toast.success(`${provider.displayName} connected`);
      } else {
        toast.success(`${provider.displayName} authorization completed. The connection is activating.`);
      }
      onCompleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to connect ${provider.displayName}`);
    }
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        icon={icon}
        className={className}
        disabled={pending}
        aria-label={buttonLabel && !pending ? label : undefined}
        onClick={() => (fields.length > 0 ? setCollectingFields(true) : void run({}))}
      >
        {pending ? 'Connecting…' : (buttonLabel ?? label)}
      </Button>
      {collectingFields && (
        <AuthFieldsDialog
          provider={provider}
          fields={fields}
          title={label}
          pending={pending}
          onSubmit={values => void run(values)}
          onClose={() => setCollectingFields(false)}
        />
      )}
    </>
  );
}
