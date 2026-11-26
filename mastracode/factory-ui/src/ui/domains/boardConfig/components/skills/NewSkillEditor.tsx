import { InlineText } from '@mastra/playground-ui/domains/factory';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useFactorySkillCreateMutation } from '../../../../../hooks/useFactorySkills';
import { useLeaveGuard } from '../../hooks/useLeaveGuard';
import { DiscardChangesDialog } from '../DiscardChangesDialog';
import { SaveBar } from '../SaveBar';
import { composeSkillMarkdown } from './skillMarkdown';
import { SkillDescription } from './SkillDescription';
import { SkillInstructions } from './SkillInstructions';

const SKILL_FOLDER_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SKILL_NAME_LENGTH = 64;

function nameProblem(name: string): string | undefined {
  if (name === '' || (SKILL_FOLDER_NAME_RE.test(name) && name.length <= MAX_SKILL_NAME_LENGTH)) return undefined;
  return `Use up to ${MAX_SKILL_NAME_LENGTH} lowercase letters, digits, and single hyphens, such as release-notes.`;
}

function createProblem(name: string, description: string): string | undefined {
  if (name === '') return 'Name the skill to create it.';
  if (nameProblem(name)) return 'Fix the name to create it.';
  if (description.trim() === '') return 'Add a description to create it.';
  return undefined;
}

export function NewSkillEditor({ factoryId, onCreated }: { factoryId: string; onCreated: (name: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const create = useFactorySkillCreateMutation(factoryId);
  const changed = name !== '' || description !== '' || instructions !== '';
  const { blocker, leave } = useLeaveGuard(changed);
  const invalidName = nameProblem(name);
  const problem = createProblem(name, description);

  const discard = () => {
    setName('');
    setDescription('');
    setInstructions('');
    create.reset();
  };
  const submit = () =>
    create.mutate(
      { name, content: composeSkillMarkdown({ name, description, instructions }) },
      { onSuccess: () => leave(() => onCreated(name)) },
    );

  return (
    <div className="flex flex-col gap-8">
      <div inert={create.isPending} className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Txt as="p" variant="body" tone="ink" className="min-w-0 break-words">
            <InlineText
              value={name}
              label="Name"
              placeholder="skill-name"
              readOnly={false}
              autoFocus
              variant="body"
              tone="ink"
              className="zoom-safe-text"
              onChange={value => setName(value.trim())}
            />
          </Txt>
          {invalidName && (
            <Txt as="p" variant="caption" className="text-destructive-foreground">
              {invalidName}
            </Txt>
          )}
          <SkillDescription value={description} required={false} readOnly={false} onChange={setDescription} />
        </div>

        <SkillInstructions value={instructions} readOnly={false} onChange={setInstructions} />
      </div>

      {changed && (
        <SaveBar
          status={problem ?? 'Only this Factory gets the skill. Agents can load it from their next session.'}
          notices={
            create.error && (
              <Notice variant="destructive" role="alert">
                <Notice.Message>{create.error.message}</Notice.Message>
              </Notice>
            )
          }
        >
          <Button size="sm" variant="ghost" onClick={discard} disabled={create.isPending}>
            Discard
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={submit}
            disabled={problem !== undefined}
            loading={create.isPending}
          >
            Create
          </Button>
        </SaveBar>
      )}

      <DiscardChangesDialog
        blocker={blocker}
        title="Discard this new skill?"
        description="It has not been created yet."
      />
    </div>
  );
}
