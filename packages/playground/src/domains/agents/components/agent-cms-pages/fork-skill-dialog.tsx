import { AlertDialog, Input } from '@mastra/playground-ui';
import { useEffect, useState } from 'react';

export interface ForkSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The original skill being forked. Used to suggest a default name. */
  sourceName: string;
  /** Names of the user's existing skills, to detect collisions before submit. */
  existingNames: string[];
  /** Whether a fork mutation is currently pending. */
  isPending?: boolean;
  /** Called with the chosen name when the user confirms. */
  onConfirm: (name: string) => void;
}

function suggestForkName(sourceName: string, existingNames: string[]): string {
  const base = `${sourceName}-fork`;
  if (!existingNames.includes(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${sourceName}-fork-${i}`;
    if (!existingNames.includes(candidate)) return candidate;
  }
  return base;
}

export function ForkSkillDialog({
  open,
  onOpenChange,
  sourceName,
  existingNames,
  isPending,
  onConfirm,
}: ForkSkillDialogProps) {
  const [name, setName] = useState('');

  // Re-seed the suggested name whenever the dialog opens for a different source.
  useEffect(() => {
    if (open) setName(suggestForkName(sourceName, existingNames));
  }, [open, sourceName, existingNames]);

  const trimmed = name.trim();
  const collides = existingNames.includes(trimmed);
  const canSubmit = trimmed.length > 0 && !collides && !isPending;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Fork "{sourceName}"</AlertDialog.Title>
          <AlertDialog.Description>
            Creates a private copy in your skills that you can edit. The original stays untouched.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <div className="px-6 py-2">
          <label className="block text-ui-sm text-neutral4 mb-1.5" htmlFor="fork-skill-name">
            New skill name
          </label>
          <Input
            id="fork-skill-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="my-skill-fork"
            autoFocus
            data-testid="fork-skill-name-input"
          />
          {collides && (
            <div className="mt-1.5 text-ui-xs text-red-400">You already have a skill named "{trimmed}".</div>
          )}
        </div>
        <AlertDialog.Footer>
          <AlertDialog.Cancel disabled={isPending}>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action
            disabled={!canSubmit}
            onClick={e => {
              if (!canSubmit) {
                e.preventDefault();
                return;
              }
              onConfirm(trimmed);
            }}
            data-testid="fork-skill-confirm"
          >
            {isPending ? 'Forking...' : 'Fork skill'}
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
