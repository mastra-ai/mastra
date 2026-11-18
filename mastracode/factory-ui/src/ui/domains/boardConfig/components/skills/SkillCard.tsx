import { Badge } from '@mastra/playground-ui/components/Badge';
import { CardContent, CardLink } from '@mastra/playground-ui/components/Card';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconChevronRightMedium } from '@mastra/playground-ui/icons/central/IconChevronRightMedium';

import type { FactorySkillInfo } from '../../../../../api/types';
import { HrefLink } from '../../../../ui/HrefLink';
import { SkillBadges } from './SkillBadges';

export const SKILL_CARD_CONTENT = 'flex items-center gap-4';
export const SKILL_CARD_TEXT = 'flex min-w-0 flex-1 flex-col gap-0.5';

export function SkillCard({ skill, href }: { skill: FactorySkillInfo; href: string }) {
  return (
    <CardLink elevation="flat" href={href} LinkComponent={HrefLink}>
      <CardContent className={SKILL_CARD_CONTENT}>
        <div className={SKILL_CARD_TEXT}>
          <span className="flex items-center gap-2">
            <Txt tone="ink" as="span" variant="body">
              {skill.name}
            </Txt>
            {skill.error && <Badge variant="destructive">Failed to load</Badge>}
            <SkillBadges skill={skill} />
          </span>
          {skill.error ? (
            <Txt as="span" variant="caption" className="text-destructive-foreground whitespace-pre-wrap">
              Agents cannot load this skill: {skill.error}
            </Txt>
          ) : (
            <Txt tone="muted" as="span" variant="caption">
              {skill.description}
            </Txt>
          )}
        </div>
        <IconChevronRightMedium aria-hidden className="text-muted-foreground size-icon-md shrink-0" />
      </CardContent>
    </CardLink>
  );
}
