import { useState } from 'react';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Input } from '@mastra/playground-ui/components/Input';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';

import {
  useFactorySkillsQuery,
  useResetFactorySkillMutation,
  useUpdateFactorySkillMutation,
} from '../../../../hooks/useFactorySkills';
import type { FactorySkillInfo } from '../../../../api/types';
import { SettingsCard } from './SettingsCard';
import { SettingsSubsection } from './SettingsSubsection';

/** The built-in skills shown on the Skills page, in display order. */
const DISPLAYED_SKILLS: { name: string; title: string }[] = [
  { name: 'factory-triage', title: 'Triage' },
  { name: 'factory-plan', title: 'Planning' },
  { name: 'factory-review', title: 'Review' },
  { name: 'factory-rereview', title: 'Re-review' },
];

function SkillEditor({ skill }: { skill: FactorySkillInfo }) {
  const [description, setDescription] = useState(skill.description);
  const [content, setContent] = useState(skill.content);
  const update = useUpdateFactorySkillMutation();
  const reset = useResetFactorySkillMutation();

  const savedDescription = description.trim();
  const dirty = savedDescription !== skill.description || content !== skill.content;
  const busy = update.isPending || reset.isPending;
  const canSave = dirty && savedDescription.length > 0 && content.trim().length > 0 && !busy;
  const error = update.error ?? reset.error;

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <label className="flex flex-col gap-1">
        <Txt as="span" variant="ui-sm" className="text-icon3">
          Description
        </Txt>
        <Input
          value={description}
          onChange={event => setDescription(event.target.value)}
          disabled={busy}
          aria-label={`${skill.name} description`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <Txt as="span" variant="ui-sm" className="text-icon3">
          Instructions
        </Txt>
        <Textarea
          value={content}
          onChange={event => setContent(event.target.value)}
          disabled={busy}
          rows={16}
          className="min-h-64 font-mono"
          aria-label={`${skill.name} instructions`}
        />
      </label>
      {error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {error instanceof Error ? error.message : 'Failed to save skill'}
        </Txt>
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          disabled={!canSave}
          onClick={() => update.mutate({ name: skill.name, description: savedDescription, content })}
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
        {skill.isCustomized && (
          <Button variant="ghost" disabled={busy} onClick={() => reset.mutate({ name: skill.name })}>
            {reset.isPending ? 'Resetting…' : 'Reset to default'}
          </Button>
        )}
      </div>
    </div>
  );
}

function SkillCard({ title, skill }: { title: string; skill: FactorySkillInfo }) {
  return (
    <SettingsCard>
      <Collapsible>
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-4 px-4 py-3 text-left">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Txt as="span" variant="ui-md" className="text-icon5">
              {title}
              <Txt as="span" variant="ui-sm" className="text-icon3 ml-2 font-mono">
                {skill.name}
              </Txt>
              {skill.isCustomized && (
                <Badge variant="info" className="ml-2">
                  Customized
                </Badge>
              )}
            </Txt>
            <Txt as="span" variant="ui-sm" className="text-icon3">
              {skill.description}
            </Txt>
          </div>
          <ChevronRight
            aria-hidden="true"
            className="text-icon3 size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          {/* Remount the editor when the saved skill changes so the local
              draft resets to the fresh server state. */}
          <SkillEditor key={`${skill.description}\u0000${skill.content}`} skill={skill} />
        </CollapsibleContent>
      </Collapsible>
    </SettingsCard>
  );
}

/**
 * The built-in Factory skills — the playbooks automated Factory runs follow
 * at each stage (Settings › Agent › Skills). Skills are editable: saved
 * customizations are stored server-side and used by every Factory session;
 * resetting restores the bundled default.
 */
export function FactorySkillsSection() {
  const skillsQuery = useFactorySkillsQuery();
  const skills = skillsQuery.data ?? [];

  return (
    <SettingsSubsection
      title="Factory skills"
      description="The playbooks Factory agents follow when working your items. Expand a skill to read or customize the instructions the agent receives."
    >
      {skillsQuery.isPending && (
        <Txt as="p" variant="ui-sm" role="status" className="text-icon3">
          Loading skills…
        </Txt>
      )}
      {skillsQuery.error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {skillsQuery.error instanceof Error ? skillsQuery.error.message : 'Failed to load skills'}
        </Txt>
      )}
      <div className="flex flex-col gap-3">
        {DISPLAYED_SKILLS.flatMap(({ name, title }) => {
          const skill = skills.find(s => s.name === name);
          return skill ? [<SkillCard key={name} title={title} skill={skill} />] : [];
        })}
      </div>
    </SettingsSubsection>
  );
}
