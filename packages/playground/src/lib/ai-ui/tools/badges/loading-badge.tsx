import { Skeleton, Spinner, Colors } from '@mastra/playground-ui';
import { BadgeWrapper } from './badge-wrapper';

export const LoadingBadge = () => {
  return (
    <BadgeWrapper
      icon={<Spinner color={Colors.neutral3} />}
      title={<Skeleton className="ml-2 w-12 h-2" />}
      collapsible={false}
    />
  );
};
