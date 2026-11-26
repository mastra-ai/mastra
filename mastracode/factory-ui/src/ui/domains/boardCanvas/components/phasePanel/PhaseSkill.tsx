import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconFileText } from '@mastra/playground-ui/icons/central/IconFileText';
import { IconPencil } from '@mastra/playground-ui/icons/central/IconPencil';
import { Link } from 'react-router';

import type { FactorySkillInfo } from '../../../../../api/types';
import { boardSkillPath } from '../../../boardConfig/boardConfigPaths';
import { SkillBadges, skillBadges } from '../../../boardConfig/components/skills/SkillBadges';
import { PanelRow } from './panelParts';

const NO_SKILL = '__none__';

/** The skill a phase's agent loads: every skill in the factory, searchable, with a link to open the picked one. */
export function PhaseSkill({
  phaseName,
  skillName,
  skills,
  skillsEditable,
  factoryId,
  boardId,
  disabled,
  onChange,
}: {
  phaseName: string;
  skillName: string | undefined;
  /** Undefined until they load, so a skill is never flagged missing early. */
  skills: FactorySkillInfo[] | undefined;
  skillsEditable: boolean;
  factoryId: string;
  boardId: string;
  disabled: boolean;
  onChange: (skill: string | undefined) => void;
}) {
  const skill = skillName ? skills?.find(candidate => candidate.name === skillName) : undefined;
  const missing = skillName !== undefined && skills !== undefined && skill === undefined;
  const names = (skills ?? []).map(candidate => candidate.name);
  // A missing skill stays picked, so the picker shows what the phase points at.
  if (skillName && !names.includes(skillName)) names.push(skillName);
  const options: ComboboxOption[] = [
    { value: NO_SKILL, label: 'No skill' },
    ...names.map(name => ({ value: name, label: name })),
  ];
  const badged = skill !== undefined && skillBadges(skill).length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <PanelRow label="Skill">
        <div className="flex min-w-0 items-center gap-1">
          <Combobox
            options={options}
            value={skillName ?? NO_SKILL}
            variant="ghost"
            size="sm"
            align="end"
            searchPlaceholder="Search skills"
            emptyText="No skill matches"
            aria-label={`${phaseName} skill`}
            disabled={disabled}
            className="min-w-0"
            onValueChange={value => onChange(value === NO_SKILL || value === '' ? undefined : value)}
          />
          {skill && (
            <Button
              size="icon-sm"
              variant="ghost"
              tooltip={`${skillsEditable ? 'Edit' : 'View'} ${skill.name}`}
              render={<Link to={boardSkillPath(factoryId, boardId, skill.name)} />}
            >
              {skillsEditable ? <IconPencil /> : <IconFileText />}
            </Button>
          )}
        </div>
      </PanelRow>
      {(missing || skill?.error || badged) && (
        <div className="flex flex-wrap items-center gap-1">
          {missing && (
            <Badge variant="destructive" size="sm">
              Not found
            </Badge>
          )}
          {skill?.error && (
            <Badge variant="destructive" size="sm">
              Failed to load
            </Badge>
          )}
          {skill && <SkillBadges skill={skill} />}
        </div>
      )}
      <SkillNote skill={skill} missing={missing} skillName={skillName} phaseName={phaseName} />
    </div>
  );
}

/** Why the phase's agent can't start, or what the picked skill does. */
function SkillNote({
  skill,
  missing,
  skillName,
  phaseName,
}: {
  skill: FactorySkillInfo | undefined;
  missing: boolean;
  skillName: string | undefined;
  phaseName: string;
}) {
  if (skill?.error) {
    return (
      <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
        Agents can't load this skill: {skill.error}
      </Txt>
    );
  }
  if (missing) {
    return (
      <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
        This factory has no {skillName} skill, so cards entering {phaseName} fail to start.
      </Txt>
    );
  }
  if (!skill?.description) return null;
  return (
    <Txt as="p" variant="caption" tone="muted" className="line-clamp-2">
      {skill.description}
    </Txt>
  );
}
