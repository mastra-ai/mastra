import {
  Dialog,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SkillSimpleForm } from '@mastra/playground-ui/domains/skills/skill-simple-form';
import { useState } from 'react';

import type { FactorySkillInfo } from '../../../../api/types';
import { useFactorySkillCreateMutation, useFactorySkillEditMutation } from '../../../../hooks/useFactorySkills';

interface FactorySkillEditorDialogProps {
  /** The skill to open; without one the dialog creates a new skill. */
  skill?: FactorySkillInfo;
  /** The Factory project whose copy of the skill is edited; without one the skill is view-only. */
  factoryId?: string;
  canEdit: boolean;
  onClose: () => void;
}

/** The names the server accepts: what agents call the skill by, and its folder name. */
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SKILL_NAME_LENGTH = 64;

function nameProblem(name: string): string | undefined {
  if (name === '' || (SKILL_NAME_RE.test(name) && name.length <= MAX_SKILL_NAME_LENGTH)) return undefined;
  return 'Use up to 64 lowercase letters, digits, and single hyphens, such as release-notes.';
}

/**
 * Writes the editor's fields back as a SKILL.md. Values are JSON-quoted, which
 * YAML reads as the same strings, so descriptions with `:` or `#` stay intact
 * and a name such as `123` stays a string, and frontmatter fields the editor
 * does not show are kept.
 */
export function composeSkillMarkdown({
  name,
  description,
  frontmatter,
  instructions,
}: {
  name: string;
  description: string;
  frontmatter?: Record<string, unknown>;
  instructions: string;
}): string {
  const fields = [
    `name: ${JSON.stringify(name)}`,
    `description: ${JSON.stringify(description)}`,
    ...Object.entries(frontmatter ?? {}).map(([key, value]) => `${key}: ${JSON.stringify(value)}`),
  ];
  return `---\n${fields.join('\n')}\n---\n\n${instructions.trim()}\n`;
}

function viewOnlyReason(factoryId: string | undefined, canEdit: boolean): string | undefined {
  if (!factoryId) return 'Open a Factory to edit its skills.';
  if (!canEdit) return 'Only organization admins can edit skills.';
  return undefined;
}

function dialogTitle(creating: boolean, readOnly: boolean): string {
  if (creating) return 'New skill';
  return readOnly ? 'View skill' : 'Edit skill';
}

/**
 * Opens a Factory skill in the shared skill editor, or creates one. Admins save an edit for this Factory
 * project, revert it to the original, or delete a skill this Factory created; everyone else views it.
 */
export function FactorySkillEditorDialog({ skill, factoryId, canEdit, onClose }: FactorySkillEditorDialogProps) {
  const creating = skill === undefined;
  const [name, setName] = useState(skill?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [instructions, setInstructions] = useState(skill?.content ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const edit = useFactorySkillEditMutation(factoryId);
  const create = useFactorySkillCreateMutation(factoryId);
  const pending = edit.isPending || create.isPending;
  const error = create.error ?? edit.error;
  const readOnlyReason = viewOnlyReason(factoryId, canEdit);
  const createdHere = skill?.origin === 'project';
  const changed = description !== (skill?.description ?? '') || instructions !== (skill?.content ?? '');
  const invalidName = creating ? nameProblem(name) : undefined;
  const canCreate = name !== '' && !invalidName && description.trim() !== '';
  const markdown = () => composeSkillMarkdown({ name, description, frontmatter: skill?.frontmatter, instructions });

  const save = () => edit.mutate({ name, content: markdown() }, { onSuccess: onClose });
  const submitCreate = () => create.mutate({ name, content: markdown() }, { onSuccess: onClose });
  const revert = () => edit.mutate({ name, content: null }, { onSuccess: onClose });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle(creating, readOnlyReason !== undefined)}</DialogTitle>
          <DialogDescription>
            {readOnlyReason ??
              (creating
                ? 'The skill belongs to this Factory only. Agents can load it from their next session, and a board phase can run it.'
                : 'Changes apply to this Factory only. Agents pick them up from their next session; running sessions keep the version they started with.')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex h-[60vh] flex-col gap-3">
            {skill?.edited && skill.originalChanged && (
              <Txt as="p" variant="caption" tone="muted" role="note">
                The original changed since this was edited. Revert to use the new original.
              </Txt>
            )}
            <SkillSimpleForm
              name={name}
              onNameChange={value => setName(value.trim())}
              nameReadOnly={!creating}
              description={description}
              onDescriptionChange={setDescription}
              instructions={instructions}
              onInstructionsChange={setInstructions}
              readOnly={readOnlyReason !== undefined}
            />
            {invalidName && (
              <Txt as="p" variant="caption" className="text-destructive-foreground">
                {invalidName}
              </Txt>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          {error && (
            <Txt
              as="span"
              variant="caption"
              role="alert"
              className="text-destructive-foreground mr-auto whitespace-pre-wrap"
            >
              {error.message}
            </Txt>
          )}
          {confirmingDelete ? (
            <>
              <Txt as="span" variant="caption" tone="muted" className="mr-auto">
                Delete {name}? Board phases that run it stop starting.
              </Txt>
              <Button onClick={() => setConfirmingDelete(false)} disabled={pending}>
                Keep
              </Button>
              <Button variant="destructive" onClick={revert} disabled={pending}>
                Delete skill
              </Button>
            </>
          ) : (
            <>
              <DialogCancel>{readOnlyReason ? 'Close' : 'Cancel'}</DialogCancel>
              {!readOnlyReason && skill?.edited && (
                <Button onClick={revert} disabled={pending}>
                  Revert to original
                </Button>
              )}
              {!readOnlyReason && createdHere && (
                <Button variant="destructive" onClick={() => setConfirmingDelete(true)} disabled={pending}>
                  Delete
                </Button>
              )}
              {!readOnlyReason && creating && (
                <Button variant="primary" onClick={submitCreate} disabled={!canCreate || pending}>
                  Create
                </Button>
              )}
              {!readOnlyReason && !creating && (
                <Button variant="primary" onClick={save} disabled={!changed || pending}>
                  Save
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
