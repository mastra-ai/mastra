import type { BreakdownRow, BreakdownTab } from '../../lib/breakdown';
import { ProviderMark } from '@/domains/llm';
import { SeriesMark } from '@/ds/components/SeriesMark';
import { AgentIcon, AiIcon, ToolsIcon, WorkflowIcon } from '@/ds/icons';

/** The entities a row can be, each marked by its icon before the name. */
const ENTITY_ICONS = { agent: AgentIcon, workflow: WorkflowIcon, tool: ToolsIcon } as const;
export type MarkedEntity = keyof typeof ENTITY_ICONS;

/** Tabs whose rows are one kind of entity. */
const TAB_ENTITY: Partial<Record<BreakdownTab, MarkedEntity>> = {
  agents: 'agent',
  workflows: 'workflow',
  tools: 'tool',
};

export function BreakdownEntityMark({ entity }: { entity: MarkedEntity }) {
  const Icon = ENTITY_ICONS[entity];
  return <SeriesMark icon={<Icon className="size-3" />} />;
}

/** The model's provider logo; a generic model icon when the usage names no provider. */
export function BreakdownModelMark({ provider }: { provider: string | undefined }) {
  if (provider) return <ProviderMark provider={provider} />;
  return <SeriesMark icon={<AiIcon className="size-3" />} />;
}

/** What a row is, before its name: the entity's icon (agents, workflows, tools), the model's provider, or nothing. */
export function BreakdownRowMark({ tab, row }: { tab: BreakdownTab; row: BreakdownRow }) {
  const entity = TAB_ENTITY[tab];
  if (entity) return <BreakdownEntityMark entity={entity} />;
  if (tab !== 'models') return null;
  return <BreakdownModelMark provider={row.provider} />;
}
