import { Badge } from '@mastra/playground-ui/components/Badge';

import type { BoardSettingsSkill } from '../../boardSettingsHost';

/** Where a skill comes from and whether someone changed it: "Overridden by app", "Custom", "Edited". */
export function skillBadges(skill: BoardSettingsSkill): string[] {
  const badges: string[] = [];
  if (skill.builtIn && skill.origin !== undefined && skill.origin !== 'bundled') badges.push('Overridden by app');
  if (skill.origin === 'project') badges.push('Custom');
  if (skill.edited) badges.push('Edited');
  return badges;
}

export function SkillBadges({ skill }: { skill: BoardSettingsSkill }) {
  return skillBadges(skill).map(badge => <Badge key={badge}>{badge}</Badge>);
}
