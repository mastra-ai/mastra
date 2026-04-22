import { useLocation, useParams } from 'react-router';
import { ConversationPanel } from '@/domains/agent-builder/components/agent-builder-edit/conversation-panel';
import { AgentPreviewPanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-preview-panel';

type LocationState = { userMessage?: string } | null;

export default function AgentBuilderAgentEdit() {
  useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state as LocationState) ?? null;

  return (
    <div className="flex h-full min-h-0 bg-surface1">
      <div className="flex-1 min-w-0 border-r border-border1 bg-surface1">
        <ConversationPanel initialUserMessage={state?.userMessage} />
      </div>
      <div className="w-[440px] shrink-0 bg-surface1">
        <AgentPreviewPanel />
      </div>
    </div>
  );
}
