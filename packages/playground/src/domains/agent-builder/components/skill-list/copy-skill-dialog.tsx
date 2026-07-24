import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { useEffect, useState } from 'react';

export interface CopySkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The original skill being copied. Used to suggest a default name. */
  sourceName: string;
  /** Names of the user's existing skills, to detect collisions before submit. */
  existingNames: string[];
  /** Whether a copy mutation is currently pending. */
  isPending?: boolean;
  /** Called with the chosen name when the user confirms. */
  onConfirm: (name: string) => void;
}

function suggestCopyName(sourceName: string, existingNames: string[]): string {
  const base = `${sourceName}-copy`;
  if (!existingNames.includes(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${sourceName}-copy-${i}`;
    if (!existingNames.includes(candidate)) return candidate;
  }
  return base;
}

export function CopySkillDialog({
  open,
  onOpenChange,
  sourceName,
  existingNames,
  isPending,
  onConfirm,
}: CopySkillDialogProps) {
  const [name, setName] = useState('');

  // Re-seed the suggested name whenever the dialog opens for a different source.
  useEffect(() => {
    if (open) setName(suggestCopyName(sourceName, existingNames));
  }, [open, sourceName, existingNames]);

  const trimmed = name.trim();
  const collides = existingNames.includes(trimmed);
  const canSubmit = trimmed.length > 0 && !collides && !isPending;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Copy "{sourceName}"</AlertDialog.Title>
          <AlertDialog.Description>
            Creates a private copy in your skills that you can edit. The original stays untouched.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <div className="px-6 py-2">
          <label className="text-ui-sm text-neutral4 mb-1.5 block" htmlFor="copy-skill-name">
            New skill name
          </label>
          <Input
            id="copy-skill-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="my-skill-copy"
            autoFocus
            data-testid="copy-skill-name-input"
          />
          {collides && (
            <div className="text-ui-xs mt-1.5 text-red-400">You already have a skill named "{trimmed}".</div>
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
            data-testid="copy-skill-confirm"
          >
            {isPending ? 'Copying...' : 'Copy skill'}
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
