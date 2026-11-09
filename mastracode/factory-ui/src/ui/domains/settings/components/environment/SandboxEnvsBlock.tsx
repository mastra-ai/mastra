import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { useSandboxEnvMutations, useSandboxEnvsQuery } from '../../../../../hooks/useSandboxEnvs';
import type { SandboxEnv, SandboxEnvAppliesTo } from '../../../workspaces/services/sandbox-envs';

const APPLIES_TO: { value: SandboxEnvAppliesTo; label: string }[] = [
  { value: 'runtime', label: 'Runtime' },
  { value: 'build', label: 'Build' },
  { value: 'both', label: 'Both' },
];

const MASK = '••••••';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * The Factory's sandbox environment variables. Values are write-only: the list
 * holds names and where each applies, and a value can only be replaced.
 */
export function SandboxEnvsBlock({ factoryId }: { factoryId: string }) {
  const envsQuery = useSandboxEnvsQuery(factoryId);
  const mutations = useSandboxEnvMutations(factoryId);

  if (envsQuery.isError) {
    return (
      <Notice variant="destructive">{errorMessage(envsQuery.error, 'Failed to load environment variables')}</Notice>
    );
  }
  if (!envsQuery.data) return <Skeleton className="h-16 w-full" />;

  const { envs, writable } = envsQuery.data;
  const disabled = !writable;

  return (
    <div className="flex flex-col gap-4">
      {!writable && (
        <Notice variant="destructive">
          Environment variables can't be saved until a credential encryption key is configured on the server.
        </Notice>
      )}
      <SettingsContainer>
        {envs.map(env => (
          <SandboxEnvRow key={env.name} env={env} disabled={disabled} mutations={mutations} />
        ))}
        <AddSandboxEnv envs={envs} disabled={disabled} mutations={mutations} />
      </SettingsContainer>
    </div>
  );
}

type Mutations = ReturnType<typeof useSandboxEnvMutations>;

function AppliesToSelect({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: SandboxEnvAppliesTo;
  disabled: boolean;
  onChange: (next: SandboxEnvAppliesTo) => void;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={next => {
        const picked = APPLIES_TO.find(option => option.value === next);
        if (picked) onChange(picked.value);
      }}
    >
      <SelectTrigger size="sm" aria-label={label} className="w-28">
        {APPLIES_TO.find(option => option.value === value)?.label}
      </SelectTrigger>
      <SelectContent>
        {APPLIES_TO.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SandboxEnvRow({ env, disabled, mutations }: { env: SandboxEnv; disabled: boolean; mutations: Mutations }) {
  const [replacement, setReplacement] = useState('');

  const replace = (event: FormEvent) => {
    event.preventDefault();
    if (!replacement) return;
    mutations.set.mutate(
      { name: env.name, value: replacement, appliesTo: env.appliesTo },
      {
        onSuccess: () => {
          setReplacement('');
          toast.success(`Replaced ${env.name}`);
        },
        onError: error => toast.error(errorMessage(error, 'Failed to save the variable')),
      },
    );
  };

  return (
    <SettingsRow
      label={<span className="font-mono">{env.name}</span>}
      description={
        <Txt as="span" variant="caption" tone="muted" aria-label={`${env.name} value hidden`}>
          {MASK}
        </Txt>
      }
    >
      <div className="flex w-full flex-wrap items-center gap-2 lg:justify-end">
        <AppliesToSelect
          label={`Where ${env.name} applies`}
          value={env.appliesTo}
          disabled={disabled}
          onChange={appliesTo =>
            mutations.updateAppliesTo.mutate(
              { name: env.name, appliesTo },
              { onError: error => toast.error(errorMessage(error, 'Failed to update the variable')) },
            )
          }
        />
        <form className="flex items-center gap-2" onSubmit={replace}>
          <Input
            type="password"
            size="sm"
            autoComplete="off"
            className="w-40 font-mono"
            aria-label={`Replace value of ${env.name}`}
            placeholder="Replace value"
            value={replacement}
            disabled={disabled}
            onChange={event => setReplacement(event.target.value)}
          />
          <Button type="submit" variant="ghost" size="sm" disabled={disabled || !replacement}>
            Replace
          </Button>
        </form>
        <AlertDialog>
          <AlertDialog.Trigger
            render={
              <Button variant="ghost" size="sm" icon={<Trash2 />} aria-label={`Delete ${env.name}`}>
                Delete
              </Button>
            }
          />
          <AlertDialog.Content>
            <AlertDialog.Header>
              <AlertDialog.Title>Delete {env.name}?</AlertDialog.Title>
              <AlertDialog.Description>
                New commands and builds stop seeing it. Its value can't be recovered.
              </AlertDialog.Description>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
              <AlertDialog.Action
                onClick={() =>
                  mutations.remove.mutate(env.name, {
                    onError: error => toast.error(errorMessage(error, 'Failed to delete the variable')),
                  })
                }
              >
                Delete
              </AlertDialog.Action>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog>
      </div>
    </SettingsRow>
  );
}

function AddSandboxEnv({ envs, disabled, mutations }: { envs: SandboxEnv[]; disabled: boolean; mutations: Mutations }) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [appliesTo, setAppliesTo] = useState<SandboxEnvAppliesTo>('runtime');
  const [confirmReplace, setConfirmReplace] = useState(false);

  const trimmedName = name.trim();
  const save = () =>
    mutations.set.mutate(
      { name: trimmedName, value, appliesTo },
      {
        onSuccess: () => {
          toast.success(`Saved ${trimmedName}`);
          setName('');
          setValue('');
          setAppliesTo('runtime');
        },
        onError: error => toast.error(errorMessage(error, 'Failed to save the variable')),
      },
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedName || !value) return;
    if (envs.some(env => env.name === trimmedName)) setConfirmReplace(true);
    else save();
  };

  return (
    <SettingsRow label="Add variable" description="Name, value and where it applies.">
      <form className="flex w-full flex-wrap items-center gap-2 lg:justify-end" onSubmit={submit}>
        <Input
          size="sm"
          autoComplete="off"
          className="w-40 font-mono"
          aria-label="Variable name"
          placeholder="NAME"
          value={name}
          disabled={disabled}
          onChange={event => setName(event.target.value)}
        />
        <Input
          type="password"
          size="sm"
          autoComplete="off"
          className="w-40 font-mono"
          aria-label="Variable value"
          placeholder="Value"
          value={value}
          disabled={disabled}
          onChange={event => setValue(event.target.value)}
        />
        <AppliesToSelect
          label="Where the new variable applies"
          value={appliesTo}
          disabled={disabled}
          onChange={setAppliesTo}
        />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          icon={<Plus />}
          disabled={disabled || !trimmedName || !value || mutations.set.isPending}
        >
          Add
        </Button>
      </form>
      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Replace {trimmedName}?</AlertDialog.Title>
            <AlertDialog.Description>
              {trimmedName} already exists. Its current value will be replaced and can't be recovered.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={save}>Replace</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </SettingsRow>
  );
}
