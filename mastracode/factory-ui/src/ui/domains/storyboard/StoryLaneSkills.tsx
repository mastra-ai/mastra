import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { BookOpen, Plus } from 'lucide-react';

import { StorySkillsLink } from './StoryExplain';
import { LANE_CHIP_CLASS } from './laneChip';
import { SKILL_SOURCE_LABELS, skillsOnLane } from './storySkills';

export function StoryLaneSkills({ stageId }: { stageId: string }) {
  const skills = skillsOnLane(stageId);
  const summary = skills.length === 1 ? '1 skill' : `${skills.length} skills`;

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={100}
        render={
          <button type="button" aria-label={`Skills on this lane: ${summary}`} className={LANE_CHIP_CLASS}>
            {skills.length === 0 ? <Plus size={12} aria-hidden /> : <BookOpen size={12} aria-hidden />}
            {skills.length === 0 ? 'No skills · Add' : summary}
          </button>
        }
      />
      <PopoverContent align="end" className="flex w-80 flex-col gap-3 p-3">
        <div className="flex flex-col gap-0.5">
          <Txt as="p" variant="label" tone="ink">
            {skills.length === 0 ? 'No skills on this lane' : 'Skills the agent loads here'}
          </Txt>
          <Txt as="span" variant="meta" tone="faint">
            Every run in this lane starts with them. A workflow step can load its own.
          </Txt>
        </div>
        {skills.length > 0 && (
          <ul className="border-border flex flex-col gap-2.5 border-t pt-3">
            {skills.map(skill => (
              <li key={skill.name} className="flex flex-col gap-0.5">
                <span className="flex items-baseline justify-between gap-2">
                  <Txt as="span" variant="label" tone="ink" className="font-mono">
                    {skill.name}
                  </Txt>
                  <Txt as="span" variant="meta" tone="faint" className="shrink-0">
                    {SKILL_SOURCE_LABELS[skill.source]}
                  </Txt>
                </span>
                <Txt as="span" variant="meta" tone="muted">
                  {skill.description}
                </Txt>
              </li>
            ))}
          </ul>
        )}
        <div className="border-border border-t pt-2">
          <StorySkillsLink>
            {skills.length === 0 ? 'Add a skill in Settings' : 'Open Skills in Settings'}
          </StorySkillsLink>
        </div>
      </PopoverContent>
    </Popover>
  );
}
