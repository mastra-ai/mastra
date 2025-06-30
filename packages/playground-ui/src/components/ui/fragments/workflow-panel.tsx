import { WorkflowIcon } from 'lucide-react';
import { AgentIcon, MemoryIcon, ToolsIcon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { PanelSection, PanelBadges, PanelLayout, PanelHeader, PanelContent } from '../elements';

type WorkflowPanelProps = {
  className?: string;
  style?: React.CSSProperties;
  Link?: any;
};

export function WorkflowPanel({ agent, memory, className, style, Link }: WorkflowPanelProps) {
  return (
    <PanelLayout>
      <PanelHeader icon={<AgentIcon />} title={agent?.name} />
      <PanelContent></PanelContent>
    </PanelLayout>
  );
}
