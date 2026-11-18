import { Badge } from '@mastra/playground-ui/components/Badge';
import { CardContent, CardLink } from '@mastra/playground-ui/components/Card';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconChevronRightMedium } from '@mastra/playground-ui/icons/central/IconChevronRightMedium';
import type { ReactNode } from 'react';

import type { FactorySkillInfo } from '../../../../../api/types';
import { HrefLink } from '../../../../ui/HrefLink';
import { SkillBadges } from './SkillBadges';

export function SkillCardBody({ title, description }: { title: ReactNode; description: ReactNode }) {
  return (
    <CardContent className="flex items-center gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title}
        {description}
      </div>
      <IconChevronRightMedium aria-hidden className="text-muted-foreground size-icon-md shrink-0" />
    </CardContent>
  );
}

export function SkillCard({ skill, href }: { skill: FactorySkillInfo; href: string }) {
  return (
    <CardLink elevation="flat" href={href} LinkComponent={HrefLink}>
      <SkillCardBody
        title={
          <span className="flex items-center gap-2">
            <Txt tone="ink" as="span" variant="body">
              {skill.name}
            </Txt>
            {skill.error && <Badge variant="destructive">Failed to load</Badge>}
            <SkillBadges skill={skill} />
          </span>
        }
        description={
          skill.error ? (
            <Txt as="span" variant="caption" className="text-destructive-foreground whitespace-pre-wrap">
              Agents cannot load this skill: {skill.error}
            </Txt>
          ) : (
            <Txt tone="muted" as="span" variant="caption">
              {skill.description}
            </Txt>
          )
        }
      />
    </CardLink>
  );
}
