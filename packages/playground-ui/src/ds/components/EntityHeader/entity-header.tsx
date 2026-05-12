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
    <div className="p-3 pb-1 w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="text-neutral6 flex min-w-0 items-center gap-2">
          <Icon size="lg">{icon}</Icon>

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
