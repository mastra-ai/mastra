import type { ListAgentVersionsResponse, VersionSelector } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useChatRunVersionIdentity } from '@/lib/ai-ui/chat/chat-context';

interface AgentRunVersionIdentityProps {
  versions: ListAgentVersionsResponse['versions'];
}

const requestedName = (requested: VersionSelector): string => {
  if (requested.label !== undefined) return requested.label;
  if (requested.status !== undefined) return requested.status;
  return 'exact';
};

export function AgentRunVersionIdentity({ versions }: AgentRunVersionIdentityProps) {
  const identity = useChatRunVersionIdentity();
  if (!identity) return null;

  const version = versions.find(candidate => candidate.id === identity.resolvedVersionId);
  const versionText = version ? `v${version.versionNumber}` : identity.resolvedVersionId.slice(0, 8);
  const label = identity.requested.versionId ? versionText : `${requestedName(identity.requested)} · ${versionText}`;

  return (
    <div className="flex min-w-0 items-center gap-1.5" role="status" aria-live="polite">
      <Txt variant="ui-xs" className="text-neutral3 shrink-0">
        Current run
      </Txt>
      <Badge variant="info">{label}</Badge>
      <CopyButton
        content={identity.resolvedVersionId}
        tooltip={`Copy resolved version ID for current run ${label}`}
        size="sm"
      />
    </div>
  );
}
