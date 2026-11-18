import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { PersonalDefaultModelFields } from './PersonalDefaultModelPicker';

export function PersonalDefaultModelSkeleton() {
  return (
    <PersonalDefaultModelFields
      actionsInert
      model={<Skeleton aria-hidden className="h-control-sm w-full rounded-full motion-reduce:before:animate-none" />}
    />
  );
}
