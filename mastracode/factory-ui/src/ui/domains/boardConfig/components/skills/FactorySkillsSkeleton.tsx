import { Card } from '@mastra/playground-ui/components/Card';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { SkillCardBody } from './SkillCard';

export function FactorySkillsSkeleton() {
  return (
    <SkeletonRows label="Loading skills" rows={3} className="gap-3">
      <Card aria-hidden elevation="flat">
        <SkillCardBody
          title={<SkeletonText line="text-body" className="w-32 motion-reduce:before:animate-none" />}
          description={
            <SkeletonText line="text-caption" className="w-72 max-w-full motion-reduce:before:animate-none" />
          }
        />
      </Card>
    </SkeletonRows>
  );
}
