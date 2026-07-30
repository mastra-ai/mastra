import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { BadgeWrapper } from './badge-wrapper';

export const LoadingBadge = () => {
  return (
    <BadgeWrapper
      icon={<Spinner className="text-neutral3" />}
      title={<Skeleton className="ml-2 h-2 w-12" />}
      collapsible={false}
    />
  );
};
