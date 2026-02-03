import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface AgentMetadataListProps {
  children: React.ReactNode;
}

export const AgentMetadataList = ({ children }: AgentMetadataListProps) => {
  return <ul className="flex flex-wrap gap-2">{children}</ul>;
};

export interface AgentMetadataListItemProps {
  children: React.ReactNode;
  className?: string;
}

export const AgentMetadataListItem = ({ children, className }: AgentMetadataListItemProps) => {
  return <li className={cn('shrink-0 font-medium flex', className)}>{children}</li>;
};

export interface AgentMetadataListEmptyProps {
  children: React.ReactNode;
}

export const AgentMetadataListEmpty = ({ children }: AgentMetadataListEmptyProps) => {
  return (
    <Txt variant="ui-sm" className="text-neutral6">
      {children}
    </Txt>
  );
};
