import type { BoardSettingsSkill } from './board-settings-host';

import { skillBadges } from './skill-badge-labels';

import { Badge } from '@/ds/components/Badge';

export function SkillBadges({ skill }: { skill: BoardSettingsSkill }) {
  return skillBadges(skill).map(badge => <Badge key={badge}>{badge}</Badge>);
}
