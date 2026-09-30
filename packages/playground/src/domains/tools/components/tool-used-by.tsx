import { SectionCard } from '@mastra/playground-ui/components/SectionCard';
import { ToolUsedByList } from './tool-used-by-list';

export interface ToolUsedByProps {
  toolId: string;
  /** The agent this page was opened from; it's listed as the current one instead of a link. */
  currentAgentId?: string;
}

export function ToolUsedBy({ toolId, currentAgentId }: ToolUsedByProps) {
  return (
    <SectionCard title="Used by" description="Agents that can call this tool.">
      <ToolUsedByList toolId={toolId} currentAgentId={currentAgentId} />
    </SectionCard>
  );
}
