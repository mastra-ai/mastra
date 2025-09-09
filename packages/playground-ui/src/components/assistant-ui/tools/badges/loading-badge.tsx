import Spinner from '@/components/ui/spinner';
import { BadgeWrapper } from './badge-wrapper';
import { Skeleton } from '@/components/ui/skeleton';
import { IconColors } from '@/ds/tokens';

export const LoadingBadge = () => {
  return (
    <BadgeWrapper
      icon={<Spinner color={IconColors.icon3} />}
      title={<Skeleton className="ml-2 w-12 h-2" />}
      collapsible={false}
    />
  );
};
