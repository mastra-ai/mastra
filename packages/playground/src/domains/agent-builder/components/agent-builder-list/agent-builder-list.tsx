import type { StoredAgentResponse } from '@mastra/client-js';
import { AgentIcon, Badge, EmptyState } from '@mastra/playground-ui';
import { Globe, SearchIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useLinkComponent } from '@/lib/framework';

export type AgentBuilderListProps = {
  agents: StoredAgentResponse[];
  search?: string;
};

function getModelLabel(model: StoredAgentResponse['model']): string {
  if (model && typeof model === 'object' && !Array.isArray(model) && 'provider' in model && 'name' in model) {
    return `${model.provider}/${model.name}`;
  }
  return 'Dynamic';
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < 0) return 'just now';
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;
  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < week) return `${Math.floor(diff / day)}d ago`;
  if (diff < month) return `${Math.floor(diff / week)}w ago`;
  if (diff < year) return `${Math.floor(diff / month)}mo ago`;
  return `${Math.floor(diff / year)}y ago`;
}

export function AgentBuilderList({ agents, search }: AgentBuilderListProps) {
  const { Link } = useLinkComponent();

  const filtered = useMemo(() => {
    const q = (search ?? '').trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(a => {
      const name = a.name?.toLowerCase() ?? '';
      const description = a.description?.toLowerCase() ?? '';
      return name.includes(q) || description.includes(q);
    });
  }, [agents, search]);

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center pt-10">
        <EmptyState
          iconSlot={<SearchIcon className="h-8 w-8 text-neutral3" />}
          titleSlot="No agents match your search"
          descriptionSlot="Try a different name or description."
        />
      </div>
    );
  }

  return (
    <div className="bg-surface2 border border-border1 rounded-xl divide-y divide-border1 overflow-hidden">
      {filtered.map(agent => (
        <Link
          key={agent.id}
          href={`/agent-builder/agents/${agent.id}/view`}
          className="px-6 py-5 flex items-center gap-4 hover:bg-surface3 transition-colors"
        >
          <div className="bg-surface3 p-2 rounded-md text-neutral5 flex items-center justify-center">
            <AgentIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-ui-md text-neutral6 truncate">{agent.name}</div>
            <div className="text-ui-sm text-neutral3 line-clamp-1 mt-0.5">{agent.description || 'No description'}</div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-ui-sm text-neutral3 shrink-0">
            {agent.visibility === 'public' && <Badge icon={<Globe className="h-3 w-3" />}>Public</Badge>}
            <span className="truncate max-w-[16rem]">{getModelLabel(agent.model)}</span>
            <span>Updated {formatRelativeTime(agent.updatedAt)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function AgentBuilderListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-surface2 border border-border1 rounded-xl divide-y divide-border1 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-5 flex items-center gap-4">
          <div className="h-9 w-9 rounded-md bg-surface3 animate-pulse" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 w-48 bg-surface3 rounded animate-pulse" />
            <div className="h-3 w-72 max-w-full bg-surface3 rounded animate-pulse" />
          </div>
          <div className="hidden sm:block h-3 w-24 bg-surface3 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
