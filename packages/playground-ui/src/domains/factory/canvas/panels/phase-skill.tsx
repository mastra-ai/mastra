import { PanelRow } from '../panel-parts';
import type { PanelSkill } from './types';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Combobox } from '@/ds/components/Combobox';
import type { ComboboxOption } from '@/ds/components/Combobox';
import { Txt } from '@/ds/components/Txt';
import { IconFileText } from '@/ds/icons/central/IconFileText';
import { IconPencil } from '@/ds/icons/central/IconPencil';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import type { LinkComponent } from '@/ds/types/link-component';

const NO_SKILL = '__none__';

/**
 * The skill a phase's agent loads: every skill in the factory, searchable, with a link to open the picked one, to list
 * them all, and to write a new one when the user may edit skills.
 */
export function PhaseSkill({
  phaseName,
  skillName,
  skills,
  skillsEditable,
  skillHref,
  skillsHref,
  newSkillHref,
  badges,
  disabled,
  LinkComponent,
  onChange,
}: {
  phaseName: string;
  skillName: string | undefined;
  /** Undefined until they load, so a skill is never flagged missing early. */
  skills: readonly PanelSkill[] | undefined;
  skillsEditable: boolean;
  /** Where the picked skill opens. */
  skillHref: string | undefined;
  /** Where the factory's skills are listed. */
  skillsHref: string;
  /** Where a new skill is written; offered only when `skillsEditable`. */
  newSkillHref: string;
  /** Where the picked skill comes from and whether someone changed it: "Custom", "Edited". */
  badges: readonly string[];
  disabled: boolean;
  LinkComponent: LinkComponent;
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
  const badged = skill !== undefined && badges.length > 0;

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
              render={<LinkComponent href={skillHref} />}
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
          {skill && badges.map(badge => <Badge key={badge}>{badge}</Badge>)}
        </div>
      )}
      <SkillNote skill={skill} missing={missing} skillName={skillName} phaseName={phaseName} />
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" variant="ghost" render={<LinkComponent href={skillsHref} />}>
          All skills
        </Button>
        {skillsEditable && (
          <Button size="sm" variant="ghost" icon={<IconPlusMedium />} render={<LinkComponent href={newSkillHref} />}>
            New skill
          </Button>
        )}
      </div>
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
  skill: PanelSkill | undefined;
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
