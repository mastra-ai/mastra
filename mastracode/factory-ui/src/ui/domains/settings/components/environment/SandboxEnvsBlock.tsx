import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
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
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Field, FieldDescription, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Table } from '@mastra/playground-ui/components/Table';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useId, useState } from 'react';

import { useSandboxEnvMutations, useSandboxEnvsQuery } from '../../../../../hooks/useSandboxEnvs';
import { relativeTime } from '../../../../../lib/date/relativeTime';
import type { SandboxEnv, SandboxEnvAppliesTo } from '../../../workspaces/services/sandbox-envs';

const MASK = '••••••••••••';

type Mutations = ReturnType<typeof useSandboxEnvMutations>;
type Targets = { build: boolean; runtime: boolean };

function toTargets(appliesTo: SandboxEnvAppliesTo): Targets {
  return { build: appliesTo !== 'runtime', runtime: appliesTo !== 'build' };
}

function toAppliesTo({ build, runtime }: Targets): SandboxEnvAppliesTo | undefined {
  if (build && runtime) return 'both';
  if (build) return 'build';
  if (runtime) return 'runtime';
  return undefined;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Opens the add dialog; rendered as the Environment variables subsection action. */
export function AddSandboxEnvButton({ factoryId }: { factoryId: string }) {
  const envsQuery = useSandboxEnvsQuery(factoryId);
  const mutations = useSandboxEnvMutations(factoryId);
  const [open, setOpen] = useState(false);
  const data = envsQuery.data;

  return (
    <>
      <Button size="sm" icon={<Plus />} disabled={!data?.writable} onClick={() => setOpen(true)}>
        Add variable
      </Button>
      {open && data && <SandboxEnvDialog envs={data.envs} mutations={mutations} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The Factory's sandbox environment variables. Values are write-only: the
 * table lists names and where each applies; editing sets a new value without
 * showing the old one.
 */
export function SandboxEnvsBlock({ factoryId }: { factoryId: string }) {
  const envsQuery = useSandboxEnvsQuery(factoryId);
  const mutations = useSandboxEnvMutations(factoryId);
  const [editing, setEditing] = useState<SandboxEnv>();
  const [deleting, setDeleting] = useState<SandboxEnv>();

  if (envsQuery.isError) {
    return (
      <Notice variant="destructive">{errorMessage(envsQuery.error, 'Failed to load environment variables')}</Notice>
    );
  }
  if (!envsQuery.data) return <Skeleton className="h-16 w-full" />;

  const { envs, writable } = envsQuery.data;

  return (
    <div className="flex flex-col gap-4">
      {!writable && (
        <Notice variant="destructive">
          Environment variables can't be saved until a credential encryption key is configured on the server.
        </Notice>
      )}
      {envs.length === 0 ? (
        <Txt as="p" variant="body-sm" tone="muted">
          No variables yet.
        </Txt>
      ) : (
        <Table variant="inset" aria-label="Environment variables">
          <Table.Header>
            <Table.Row>
              <Table.Head>Name</Table.Head>
              <Table.Head>Value</Table.Head>
              <Table.Head>Applies to</Table.Head>
              <Table.Head>Updated</Table.Head>
              <Table.Head align="end">
                <span className="sr-only">Actions</span>
              </Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {envs.map(env => {
              const targets = toTargets(env.appliesTo);
              return (
                <Table.Row key={env.name}>
                  <Table.Cell>
                    <span className="font-mono">{env.name}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <Txt
                      as="span"
                      variant="body-sm"
                      tone="muted"
                      className="font-mono"
                      aria-label={`${env.name} value hidden`}
                    >
                      {MASK}
                    </Txt>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1" aria-label={`${env.name} applies to`}>
                      {targets.build && (
                        <Badge size="sm" variant="purple">
                          Build
                        </Badge>
                      )}
                      {targets.runtime && (
                        <Badge size="sm" variant="cyan">
                          Runtime
                        </Badge>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Txt as="span" variant="body-sm" tone="muted">
                      {relativeTime(env.updatedAt)}
                    </Txt>
                  </Table.Cell>
                  <Table.Cell align="end">
                    <DropdownMenu>
                      <DropdownMenu.Trigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label={`${env.name} actions`}>
                            <MoreHorizontal />
                          </Button>
                        }
                      />
                      <DropdownMenu.Content align="end">
                        <DropdownMenu.Item disabled={!writable} onClick={() => setEditing(env)}>
                          Edit
                        </DropdownMenu.Item>
                        <DropdownMenu.Item onClick={() => setDeleting(env)}>Delete</DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      )}
      {editing && (
        <SandboxEnvDialog env={editing} envs={envs} mutations={mutations} onClose={() => setEditing(undefined)} />
      )}
      <AlertDialog open={deleting !== undefined} onOpenChange={open => !open && setDeleting(undefined)}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete {deleting?.name}?</AlertDialog.Title>
            <AlertDialog.Description>
              New commands and builds stop seeing it. Its value can't be recovered.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={() => {
                if (!deleting) return;
                mutations.remove.mutate(deleting.name, {
                  onError: error => toast.error(errorMessage(error, 'Failed to delete the variable')),
                });
              }}
            >
              Delete
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </div>
  );
}

/** Add (no `env`) or edit (with `env`) one variable. */
function SandboxEnvDialog({
  env,
  envs,
  mutations,
  onClose,
}: {
  env?: SandboxEnv;
  envs: SandboxEnv[];
  mutations: Mutations;
  onClose: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(env?.name ?? '');
  const [value, setValue] = useState('');
  const [targets, setTargets] = useState<Targets>(toTargets(env?.appliesTo ?? 'runtime'));
  const [error, setError] = useState<string>();

  const trimmedName = name.trim();
  const appliesTo = toAppliesTo(targets);
  const taken = !env && envs.some(existing => existing.name === trimmedName);
  const changed = env ? Boolean(value) || appliesTo !== env.appliesTo : Boolean(trimmedName && value);
  const pending = mutations.set.isPending || mutations.updateAppliesTo.isPending;
  const canSave = changed && appliesTo !== undefined && !taken && !pending;

  const callbacks = {
    onSuccess: () => {
      toast.success(`Saved ${trimmedName}`);
      onClose();
    },
    onError: (failure: unknown) => setError(errorMessage(failure, 'Failed to save the variable')),
  };

  const save = () => {
    if (!canSave || !appliesTo) return;
    setError(undefined);
    // A new value is sent with where it applies; otherwise only where it applies changes.
    if (value) mutations.set.mutate({ name: trimmedName, value, appliesTo }, callbacks);
    else mutations.updateAppliesTo.mutate({ name: trimmedName, appliesTo }, callbacks);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()} pending={pending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{env ? `Edit ${env.name}` : 'Add variable'}</DialogTitle>
          <DialogDescription>Values are encrypted and can't be viewed after saving.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field invalid={taken}>
            <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
            <Input
              id={`${id}-name`}
              autoFocus={!env}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder="NAME"
              value={name}
              disabled={Boolean(env)}
              onChange={event => setName(event.target.value)}
            />
            {taken && <FieldError>{trimmedName} already exists. Edit it instead.</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-value`}>Value</FieldLabel>
            <Input
              id={`${id}-value`}
              autoFocus={Boolean(env)}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder={env ? 'Leave empty to keep the current value' : 'Value'}
              value={value}
              onChange={event => setValue(event.target.value)}
            />
          </Field>
          <Field invalid={appliesTo === undefined}>
            <FieldLabel>Applies to</FieldLabel>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <Checkbox
                  aria-label="Build"
                  checked={targets.build}
                  onCheckedChange={checked => setTargets(current => ({ ...current, build: checked === true }))}
                />
                <Txt as="span" variant="body-sm">
                  Build
                </Txt>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  aria-label="Runtime"
                  checked={targets.runtime}
                  onCheckedChange={checked => setTargets(current => ({ ...current, runtime: checked === true }))}
                />
                <Txt as="span" variant="body-sm">
                  Runtime
                </Txt>
              </label>
            </div>
            <FieldDescription>
              Build: template builds and setup commands. Runtime: every command, from the next one on.
            </FieldDescription>
            {appliesTo === undefined && <FieldError>Pick at least one.</FieldError>}
          </Field>
          {error && (
            <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
              {error}
            </Txt>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={!canSave} onConfirm={save}>
            {pending ? 'Saving…' : 'Save'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
