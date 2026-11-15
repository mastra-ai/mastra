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
import { useFactorySkillEditMutation } from '../../../../hooks/useFactorySkills';

interface FactorySkillEditorDialogProps {
  skill: FactorySkillInfo;
  /** The Factory project whose copy of the skill is edited; without one the skill is view-only. */
  factoryId?: string;
  canEdit: boolean;
  onClose: () => void;
}

/**
 * Writes the editor's fields back as a SKILL.md. Values are JSON-quoted, which
 * YAML reads as the same strings, so descriptions with `:` or `#` stay intact,
 * and frontmatter fields the editor does not show are kept.
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
    `name: ${name}`,
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

/**
 * Opens a Factory skill in the shared skill editor. Admins save the edit for
 * this Factory project or revert it to the original; everyone else views it.
 */
export function FactorySkillEditorDialog({ skill, factoryId, canEdit, onClose }: FactorySkillEditorDialogProps) {
  const [description, setDescription] = useState(skill.description);
  const [instructions, setInstructions] = useState(skill.content);
  const edit = useFactorySkillEditMutation(factoryId);
  const readOnlyReason = viewOnlyReason(factoryId, canEdit);
  const changed = description !== skill.description || instructions !== skill.content;

  const save = () =>
    edit.mutate(
      {
        name: skill.name,
        content: composeSkillMarkdown({ name: skill.name, description, frontmatter: skill.frontmatter, instructions }),
      },
      { onSuccess: onClose },
    );
  const revert = () => edit.mutate({ name: skill.name, content: null }, { onSuccess: onClose });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{readOnlyReason ? 'View skill' : 'Edit skill'}</DialogTitle>
          <DialogDescription>
            {readOnlyReason ??
              'Changes apply to this Factory only. Agents pick them up from their next session; running sessions keep the version they started with.'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex h-[60vh] flex-col gap-3">
            {skill.edited && skill.originalChanged && (
              <Txt as="p" variant="caption" tone="muted" role="note">
                The original changed since this was edited. Revert to use the new original.
              </Txt>
            )}
            <SkillSimpleForm
              name={skill.name}
              onNameChange={() => {}}
              nameReadOnly
              description={description}
              onDescriptionChange={setDescription}
              instructions={instructions}
              onInstructionsChange={setInstructions}
              readOnly={readOnlyReason !== undefined}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          {edit.error && (
            <Txt
              as="span"
              variant="caption"
              role="alert"
              className="text-destructive-foreground mr-auto whitespace-pre-wrap"
            >
              {edit.error.message}
            </Txt>
          )}
          <DialogCancel>{readOnlyReason ? 'Close' : 'Cancel'}</DialogCancel>
          {!readOnlyReason && skill.edited && (
            <Button onClick={revert} disabled={edit.isPending}>
              Revert to original
            </Button>
          )}
          {!readOnlyReason && (
            <Button variant="primary" onClick={save} disabled={!changed || edit.isPending}>
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
