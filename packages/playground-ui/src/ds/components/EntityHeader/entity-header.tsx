import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons';

export type EntityHeaderProps = {
  icon: React.ReactNode;
  title: string;
  isLoading?: boolean;
  children?: React.ReactNode;
};

export const EntityHeader = ({ icon, title, isLoading, children }: EntityHeaderProps) => {
  return (
    <div className="w-full overflow-x-hidden p-3 pb-1">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-2 text-neutral6">
          <span className="flex size-7 shrink-0 items-center justify-center">
            <Icon size="lg">{icon}</Icon>
          </span>

          {isLoading ? (
            <Skeleton className="h-3 w-32" />
          ) : (
            <Txt variant="header-md" as="h2" className="truncate font-medium">
              {title}
            </Txt>
          )}
        </div>
        {children}
      </div>
    </div>
  );
};
