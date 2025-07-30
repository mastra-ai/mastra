import { Icon, Txt } from '@/index';
import { Skeleton } from './skeleton';

export interface EntityHeaderProps {
  icon: React.ReactNode;
  title: string;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const EntityHeader = ({ icon, title, isLoading, children }: EntityHeaderProps) => {
  return (
    <div className="p-5 w-full overflow-x-hidden">
      <div className="text-icon6 flex items-center gap-2">
        <Icon size="lg" className="bg-surface4 rounded-md p-1">
          {icon}
        </Icon>

        {isLoading ? (
          <Skeleton className="h-3 w-1/3" />
        ) : (
          <div className="flex min-w-0 items-center gap-4">
            <Txt variant="header-md" as="h2" className="truncate font-medium">
              {title}
            </Txt>
          </div>
        )}
      </div>
      {children && <div className="pt-2">{children}</div>}
    </div>
  );
};
