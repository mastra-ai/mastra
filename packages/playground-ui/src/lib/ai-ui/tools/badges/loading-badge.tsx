import { Spinner } from '@/ds/components/Spinner';
import { BadgeWrapper } from './badge-wrapper';
import { Skeleton } from '@/ds/components/Skeleton';
import { Colors } from '@/ds/tokens';

export const LoadingBadge = () => {
  return (
    <BadgeWrapper
      icon={<Spinner color={Colors.icon3} />}
      title={<Skeleton className="ml-2 w-12 h-2" />}
      collapsible={false}
    />
  );
};
