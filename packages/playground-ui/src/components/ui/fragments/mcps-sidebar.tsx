import { PanelLayout, PanelHeader, EntryList, type EntryListItem, PanelContent } from '@/components/ui/elements';
import { McpServerIcon, ToolsIcon } from '@/ds/icons';

export type McpsSidebarProps = {
  className?: string;
  style?: React.CSSProperties;
  linkComponent?: React.ComponentType<any>;
  tools?: EntryListItem[];
};

export function McpsSidebar({ tools, linkComponent, className, style }: McpsSidebarProps) {
  console.log({ tools });

  return (
    <PanelLayout>
      <PanelHeader title="Available tools" icon={<McpServerIcon />} />
      <PanelContent>
        <EntryList items={tools} linkComponent={linkComponent} />
      </PanelContent>
    </PanelLayout>
  );
}
