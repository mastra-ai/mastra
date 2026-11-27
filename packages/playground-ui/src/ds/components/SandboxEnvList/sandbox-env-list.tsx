import { useId, useState } from 'react';

import { AlertDialog } from '@/ds/components/AlertDialog';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Checkbox } from '@/ds/components/Checkbox';
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
} from '@/ds/components/Dialog';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { Notice } from '@/ds/components/Notice';
import { Table } from '@/ds/components/Table';
import { toast } from '@/ds/components/Toaster';
import { InfoTooltip } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { IconDotGrid1x3Horizontal } from '@/ds/icons/central/IconDotGrid1x3Horizontal';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { formatRelativeTime } from '@/utils/relative-time';

export type SandboxEnvAppliesTo = 'build' | 'runtime' | 'both';

export interface SandboxEnv {
  name: string;
  appliesTo: SandboxEnvAppliesTo;
  updatedAt: string;
}

interface MutationCallbacks {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

interface SandboxEnvMutation<TInput> {
  mutate: (input: TInput, callbacks?: MutationCallbacks) => void;
  isPending: boolean;
}

/** Writes for one environment's variables; a react-query `useMutation` result fits each slot. */
export interface SandboxEnvMutations {
  set: SandboxEnvMutation<{ name: string; value: string; appliesTo: SandboxEnvAppliesTo }>;
  updateAppliesTo: SandboxEnvMutation<{ name: string; appliesTo: SandboxEnvAppliesTo }>;
  remove: SandboxEnvMutation<string>;
}

const MASK = '••••••••••••';

type Mutations = SandboxEnvMutations;
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

export interface AddSandboxEnvButtonProps {
  envs: SandboxEnv[] | undefined;
  writable: boolean;
  mutations: SandboxEnvMutations;
}

/** Opens the add dialog; meant as the variables section's action. */
export function AddSandboxEnvButton({ envs, writable, mutations }: AddSandboxEnvButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" icon={<IconPlusMedium />} disabled={!envs || !writable} onClick={() => setOpen(true)}>
        Add variable
      </Button>
      {open && envs && <SandboxEnvDialog envs={envs} mutations={mutations} onClose={() => setOpen(false)} />}
    </>
  );
}

export interface SandboxEnvListProps {
  envs: SandboxEnv[];
  writable: boolean;
  mutations: SandboxEnvMutations;
  /** Label for a variable's last update; defaults to a short relative time. */
  formatUpdatedAt?: (iso: string) => string;
}

/**
 * Sandbox environment variables. Values are write-only: the table lists names
 * and where each applies; editing sets a new value without showing the old one.
 */
export function SandboxEnvList({
  envs,
  writable,
  mutations,
  formatUpdatedAt = iso => formatRelativeTime(iso) ?? '',
}: SandboxEnvListProps) {
  const [editing, setEditing] = useState<SandboxEnv>();
  const [deleting, setDeleting] = useState<SandboxEnv>();

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
              <Table.Head>
                <span className="inline-flex items-center gap-1">
                  Applies to
                  <InfoTooltip aria-label="About where variables apply">
                    Runtime: every command in the sandbox, from the next one on. Build: only the template image build
                    and setup commands, never runtime commands.
                  </InfoTooltip>
                </span>
              </Table.Head>
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
                      {formatUpdatedAt(env.updatedAt)}
                    </Txt>
                  </Table.Cell>
                  <Table.Cell align="end">
                    <DropdownMenu>
                      <DropdownMenu.Trigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label={`${env.name} actions`}>
                            <IconDotGrid1x3Horizontal />
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
            Save
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
