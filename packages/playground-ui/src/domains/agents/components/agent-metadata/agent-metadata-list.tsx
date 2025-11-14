import { Txt } from '@/ds/components/Txt';

export interface AgentMetadataListProps {
  children: React.ReactNode;
}

export const AgentMetadataList = ({ children }: AgentMetadataListProps) => {
  return <ul className="flex flex-wrap gap-2">{children}</ul>;
};

export interface AgentMetadataListItemProps {
  children: React.ReactNode;
}

export const AgentMetadataListItem = ({ children }: AgentMetadataListItemProps) => {
  return <li className="shrink-0 font-medium">{children}</li>;
};

export interface AgentMetadataListEmptyProps {
  children: React.ReactNode;
}

export const AgentMetadataListEmpty = ({ children }: AgentMetadataListEmptyProps) => {
  return (
    <Txt variant="ui-sm" className="text-icon6">
      {children}
    </Txt>
  );
};
