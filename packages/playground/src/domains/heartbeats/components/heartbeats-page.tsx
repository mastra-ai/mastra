import { Combobox, ErrorState, ListSearch } from '@mastra/playground-ui';
import { useMemo, useState } from 'react';
import { useHeartbeats } from '../hooks/use-heartbeats';
import { HeartbeatsList } from './heartbeats-list';
import type { HeartbeatModeFilter } from './heartbeats-list';
import { useAgents } from '@/domains/agents/hooks/use-agents';

const ALL_AGENTS = '__all__';

export function HeartbeatsPage() {
  const [search, setSearch] = useState('');
  const [agentId, setAgentId] = useState<string>(ALL_AGENTS);
  const [mode, setMode] = useState<HeartbeatModeFilter>('all');

  const ownerId = agentId === ALL_AGENTS ? undefined : agentId;
  const { data: heartbeats, isLoading, error } = useHeartbeats({ ownerId });
  const { data: agents } = useAgents();

  const agentOptions = useMemo(() => {
    const entries = agents ? Object.entries(agents) : [];
    return [
      { value: ALL_AGENTS, label: 'All agents' },
      ...entries.map(([id, agent]) => ({ value: id, label: agent?.name ?? id })),
    ];
  }, [agents]);

  if (error) {
    return <ErrorState title="Failed to load heartbeats" message={error.message} />;
  }

  return (
    <div className="grid grid-rows-[auto_1fr] gap-4 h-full overflow-hidden">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grow max-w-120">
          <ListSearch onSearch={setSearch} label="Filter heartbeats" placeholder="Filter by id, agent, or thread" />
        </div>
        <div className="min-w-56">
          <Combobox
            options={agentOptions}
            value={agentId}
            onValueChange={setAgentId}
            placeholder="All agents"
            searchPlaceholder="Search agents..."
            emptyText="No agents found"
          />
        </div>
        <ModeToggle value={mode} onChange={setMode} />
      </div>
      <div className="overflow-y-auto">
        <HeartbeatsList schedules={heartbeats ?? []} isLoading={isLoading} search={search} mode={mode} />
      </div>
    </div>
  );
}

const MODES: { value: HeartbeatModeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'threaded', label: 'Threaded' },
  { value: 'threadless', label: 'Threadless' },
];

function ModeToggle({
  value,
  onChange,
}: {
  value: HeartbeatModeFilter;
  onChange: (mode: HeartbeatModeFilter) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Heartbeat mode"
      className="inline-flex items-center rounded-md border border-border1 bg-surface3 p-0.5 text-ui-sm"
    >
      {MODES.map(({ value: v, label }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={
            value === v
              ? 'rounded px-3 py-1 bg-surface5 text-icon6 font-medium'
              : 'rounded px-3 py-1 text-icon3 hover:text-icon5'
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}
