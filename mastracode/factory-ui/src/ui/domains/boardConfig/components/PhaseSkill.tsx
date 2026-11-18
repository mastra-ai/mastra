import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconBook } from '@mastra/playground-ui/icons/central/IconBook';
import { IconFileText } from '@mastra/playground-ui/icons/central/IconFileText';
import { IconPencil } from '@mastra/playground-ui/icons/central/IconPencil';
import { Link } from 'react-router';

import type { FactorySkillInfo } from '../../../../api/types';
import { boardSkillPath } from '../boardConfigPaths';
import { SkillBadges } from './skills/SkillBadges';

const NO_SKILL = '__none__';

export function PhaseSkill({
  factoryId,
  boardId,
  phaseName,
  skillName,
  skills,
  skillsEditable,
  disabled,
  onChange,
}: {
  factoryId: string;
  boardId: string;
  phaseName: string;
  skillName: string | undefined;
  skills: FactorySkillInfo[] | undefined;
  skillsEditable: boolean;
  disabled: boolean;
  onChange: (skillName: string | undefined) => void;
}) {
  const skill = skillName ? skills?.find(candidate => candidate.name === skillName) : undefined;
  const skillMissing = skillName !== undefined && skills !== undefined && skill === undefined;

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <Select
          value={skillName ?? NO_SKILL}
          disabled={disabled}
          onValueChange={value => onChange(value === NO_SKILL ? undefined : String(value))}
        >
          <SelectTrigger variant="ghost" size="sm" aria-label={`${phaseName} skill`} className="-ml-2 w-fit">
            <span className="flex min-w-0 items-center gap-2">
              <IconBook aria-hidden className="text-muted-foreground size-icon-md shrink-0" />
              <span className="truncate">{skillName ?? 'No skill'}</span>
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SKILL}>None</SelectItem>
            {(skills ?? []).map(candidate => (
              <SelectItem key={candidate.name} value={candidate.name}>
                {candidate.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {skillMissing && <Badge variant="destructive">Not found</Badge>}
        {skill?.error && <Badge variant="destructive">Failed to load</Badge>}
        {skill && <SkillBadges skill={skill} />}
        {skill && (
          <Button
            size="sm"
            variant="ghost"
            icon={skillsEditable ? <IconPencil /> : <IconFileText />}
            aria-label={`${skillsEditable ? 'Edit' : 'View'} ${skill.name}`}
            className="ml-auto"
            render={<Link to={boardSkillPath(factoryId, boardId, skill.name)} />}
          >
            {skillsEditable ? 'Edit' : 'View'}
          </Button>
        )}
      </div>
      {skill?.error ? (
        <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
          Agents can't load this skill: {skill.error}
        </Txt>
      ) : skillMissing ? (
        <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
          This factory has no {skillName} skill, so cards entering {phaseName} fail to start.
        </Txt>
      ) : (
        skill?.description && (
          <Txt as="p" variant="caption" tone="muted">
            {skill.description}
          </Txt>
        )
      )}
    </>
  );
}
