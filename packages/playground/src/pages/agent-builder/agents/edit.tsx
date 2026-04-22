import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { AgentConfigurePanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { AgentPreviewChat } from '@/domains/agent-builder/components/agent-builder-edit/agent-preview-chat';
import { BrowserFrame } from '@/domains/agent-builder/components/agent-builder-edit/browser-frame';
import { ConversationPanel } from '@/domains/agent-builder/components/agent-builder-edit/conversation-panel';
import { defaultAgentFixture } from '@/domains/agent-builder/fixtures';
import type { AgentFixture } from '@/domains/agent-builder/fixtures';

type LocationState = { userMessage?: string } | null;

export default function AgentBuilderAgentEdit() {
  useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state as LocationState) ?? null;
  const [agent, setAgent] = useState<AgentFixture>(defaultAgentFixture);

  return (
    <div className="flex flex-1 min-h-0 h-full bg-surface1">
      <div className="flex w-[40ch] shrink-0 flex-col bg-surface1 py-6 px-6">
        <ConversationPanel initialUserMessage={state?.userMessage} />
      </div>
      <div className="flex flex-1 min-w-0 flex-col py-6 pr-6">
        <BrowserFrame className="grid grid-cols-[1fr_380px]">
          <AgentPreviewChat agent={agent} />

          <div className="h-full overflow-y-auto pr-6 pb-6 pt-6">
            <AgentConfigurePanel agent={agent} onAgentChange={setAgent} />
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
}
