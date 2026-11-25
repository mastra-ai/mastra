import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useRef, useState } from 'react';

import type { FactorySkillInfo } from '../../../../../api/types';
import { useFactorySkillEditMutation } from '../../../../../hooks/useFactorySkills';
import { useLeaveGuard } from '../../hooks/useLeaveGuard';
import { DiscardChangesDialog } from '../DiscardChangesDialog';
import { SaveBar } from '../SaveBar';
import { composeSkillMarkdown } from './skillMarkdown';
import { SkillBadges } from './SkillBadges';
import { SkillDescription } from './SkillDescription';
import { SkillInstructions } from './SkillInstructions';

export function SkillEditor({
  factoryId,
  skill,
  canEdit,
  onDeleted,
}: {
  factoryId: string;
  skill: FactorySkillInfo;
  canEdit: boolean;
  onDeleted: () => void;
}) {
  const [editedDescription, setEditedDescription] = useState<string>();
  const [editedInstructions, setEditedInstructions] = useState<string>();
  const description = editedDescription ?? skill.description;
  const instructions = editedInstructions ?? skill.content;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const save = useFactorySkillEditMutation(factoryId);
  const remove = useFactorySkillEditMutation(factoryId);
  const pending = save.isPending || remove.isPending;
  const changed = canEdit && (description !== skill.description || instructions !== skill.content);
  const { blocker, leave } = useLeaveGuard(changed);
  const revertable = canEdit && Boolean(skill.edited);
  const deletable = canEdit && skill.origin === 'project';

  const asEdit = (value: string, saved: string) => (value === saved && !pending ? undefined : value);
  const keepEditsMadeSince = (sent: { description: string; instructions: string }) => () => {
    setEditedDescription(current => (current === sent.description ? undefined : current));
    setEditedInstructions(current => (current === sent.instructions ? undefined : current));
  };
  const discard = () => {
    setEditedDescription(undefined);
    setEditedInstructions(undefined);
    save.reset();
  };
  const submit = () =>
    save.mutate(
      {
        name: skill.name,
        content: composeSkillMarkdown({ name: skill.name, description, frontmatter: skill.frontmatter, instructions }),
      },
      { onSuccess: keepEditsMadeSince({ description, instructions }) },
    );
  const revert = () =>
    remove.mutate(
      { name: skill.name, content: null },
      { onSuccess: keepEditsMadeSince({ description, instructions }) },
    );
  const deleteSkill = () => remove.mutate({ name: skill.name, content: null }, { onSuccess: () => leave(onDeleted) });
  const keep = () => {
    setConfirmingDelete(false);
    deleteButton.current?.focus();
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex min-h-8 flex-wrap items-center gap-2 empty:hidden">
          <SkillBadges skill={skill} />
          {(!canEdit || revertable || deletable) && (
            <div className="ml-auto flex items-center gap-1">
              {!canEdit && (
                <Txt variant="caption" tone="muted">
                  Only organization admins can edit skills.
                </Txt>
              )}
              {revertable && (
                <Button size="sm" variant="ghost" onClick={revert} disabled={pending} loading={remove.isPending}>
                  Revert to original
                </Button>
              )}
              {deletable && (
                <Button
                  ref={deleteButton}
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={pending}
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
        {confirmingDelete && (
          <Notice
            variant="warning"
            title={`Delete ${skill.name}?`}
            actionPlacement="end"
            action={
              <>
                <Button size="sm" onClick={keep} disabled={pending} autoFocus>
                  Keep
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={deleteSkill}
                  disabled={pending}
                  loading={remove.isPending}
                >
                  Delete skill
                </Button>
              </>
            }
          >
            <Notice.Message>
              Cards entering a phase that runs it won't start until the phase gets another skill.
            </Notice.Message>
          </Notice>
        )}
        {remove.error && (
          <Notice variant="destructive" role="alert">
            <Notice.Message>{remove.error.message}</Notice.Message>
          </Notice>
        )}
        {skill.error && (
          <Notice variant="destructive" role="alert">
            <Notice.Message>Agents cannot load this skill: {skill.error}</Notice.Message>
          </Notice>
        )}
        {skill.edited && skill.originalChanged && (
          <Notice variant="info" role="note">
            <Notice.Message>The original changed since this was edited. Revert to use the new original.</Notice.Message>
          </Notice>
        )}
        <SkillDescription
          value={description}
          required
          readOnly={!canEdit}
          onChange={value => setEditedDescription(asEdit(value, skill.description))}
        />
      </div>

      <SkillInstructions
        value={instructions}
        readOnly={!canEdit}
        onChange={value => setEditedInstructions(asEdit(value, skill.content))}
      />

      {changed && (
        <SaveBar
          status="Unsaved changes for this Factory. Running sessions keep the version they started with."
          notices={
            save.error && (
              <Notice variant="destructive" role="alert">
                <Notice.Message>{save.error.message}</Notice.Message>
              </Notice>
            )
          }
        >
          <Button size="sm" variant="ghost" onClick={discard} disabled={pending}>
            Discard
          </Button>
          <Button size="sm" variant="primary" onClick={submit} disabled={pending} loading={save.isPending}>
            Save
          </Button>
        </SaveBar>
      )}

      <DiscardChangesDialog
        blocker={blocker}
        title={`Discard changes to ${skill.name}?`}
        description="Your unsaved changes to this skill will be lost."
      />
    </div>
  );
}
