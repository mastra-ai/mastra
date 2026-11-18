import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { IconChevronRightMedium } from '@mastra/playground-ui/icons/central/IconChevronRightMedium';

import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { SKILL_CARD_CONTENT, SKILL_CARD_TEXT } from './SkillCard';

export function FactorySkillsSkeleton() {
  return (
    <SkeletonRows label="Loading skills" rows={3} className="gap-3">
      <Card aria-hidden elevation="flat">
        <CardContent className={SKILL_CARD_CONTENT}>
          <div className={SKILL_CARD_TEXT}>
            <SkeletonText line="text-body" className="w-32 motion-reduce:before:animate-none" />
            <SkeletonText line="text-caption" className="w-72 max-w-full motion-reduce:before:animate-none" />
          </div>
          <IconChevronRightMedium className="text-muted-foreground size-icon-md shrink-0" />
        </CardContent>
      </Card>
    </SkeletonRows>
  );
}
