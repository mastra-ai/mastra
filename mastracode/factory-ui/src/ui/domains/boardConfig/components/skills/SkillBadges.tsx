import { Badge } from '@mastra/playground-ui/components/Badge';

import type { FactorySkillInfo } from '../../../../../api/types';

export function SkillBadges({ skill }: { skill: FactorySkillInfo }) {
  return (
    <>
      {skill.builtIn && skill.origin !== undefined && skill.origin !== 'bundled' && <Badge>Overridden by app</Badge>}
      {skill.origin === 'project' && <Badge>Custom</Badge>}
      {skill.edited && <Badge>Edited</Badge>}
    </>
  );
}
