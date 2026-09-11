import { Skeleton } from '../../../ds/components/Skeleton';
import { Spinner } from '../../../ds/components/Spinner';

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
