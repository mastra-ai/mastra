import { SectionHeader } from '@/domains/cms';

import { VersionList } from './version-list';

interface AgentVersionsPanelProps {
  agentId: string;
  selectedVersionId?: string;
  onVersionSelect?: (versionId: string) => void;
}

export function AgentVersionsPanel({ agentId, selectedVersionId, onVersionSelect }: AgentVersionsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        <SectionHeader title="Versions" subtitle="History of published versions for this agent." />
      </div>
      <VersionList agentId={agentId} selectedVersionId={selectedVersionId} onVersionSelect={onVersionSelect} />
    </div>
  );
}
