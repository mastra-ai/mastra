import type { BreakdownRow, BreakdownTab } from '../../lib/breakdown';
import { ProviderMark } from '@/domains/llm';
import { SeriesMark } from '@/ds/components/SeriesMark';
import { AgentIcon, AiIcon, ToolsIcon, WorkflowIcon } from '@/ds/icons';

/** Tabs whose rows are one kind of entity, marked by its icon before each name. */
const ENTITY_ICON: Partial<Record<BreakdownTab, typeof AgentIcon>> = {
  agents: AgentIcon,
  workflows: WorkflowIcon,
  tools: ToolsIcon,
};

/**
 * What a row is, before its name: the entity's icon (agents, workflows, tools), the model's
 * provider logo (a generic model icon when the usage names no provider), or nothing.
 */
export function BreakdownRowMark({ tab, row }: { tab: BreakdownTab; row: BreakdownRow }) {
  const EntityIcon = ENTITY_ICON[tab];
  if (EntityIcon) return <SeriesMark icon={<EntityIcon className="size-3" />} />;
  if (tab !== 'models') return null;
  if (row.provider) return <ProviderMark provider={row.provider} />;
  return <SeriesMark icon={<AiIcon className="size-3" />} />;
}
