import { Txt } from '@/ds/components/Txt';
import { cn } from '@/utils/cn';

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
  return <li className={cn('flex shrink-0', className)}>{children}</li>;
};

export interface AgentMetadataListEmptyProps {
  children: React.ReactNode;
}

export const AgentMetadataListEmpty = ({ children }: AgentMetadataListEmptyProps) => {
  return (
    <Txt variant="caption" tone="muted" data-slot="metadata-empty">
      <span aria-hidden="true">None</span>
      <span className="sr-only">{children}</span>
    </Txt>
  );
};
