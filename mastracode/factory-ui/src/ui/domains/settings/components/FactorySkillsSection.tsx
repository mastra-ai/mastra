import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';

import { useFactorySkillsQuery } from '../../../../hooks/useFactorySkills';
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
          <pre className="text-ui-sm text-icon4 max-h-96 overflow-auto px-4 pb-4 font-mono whitespace-pre-wrap">
            {skill.content}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </SettingsCard>
  );
}

/**
 * Read-only view of the built-in Factory skills — the playbooks automated
 * Factory runs follow at each stage (Settings › Agent › Skills).
 */
export function FactorySkillsSection() {
  const skillsQuery = useFactorySkillsQuery();
  const skills = skillsQuery.data ?? [];

  return (
    <SettingsSubsection
      title="Factory skills"
      description="The built-in playbooks Factory agents follow when working your items. Expand a skill to read the exact instructions the agent receives."
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
