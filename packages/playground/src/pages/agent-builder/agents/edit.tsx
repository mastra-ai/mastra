import { IconButton } from '@mastra/playground-ui';
import { EyeIcon } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { AgentConfigurePanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { AgentPreviewChat } from '@/domains/agent-builder/components/agent-builder-edit/agent-preview-chat';
import { BrowserFrame } from '@/domains/agent-builder/components/agent-builder-edit/browser-frame';
import { ConversationPanel } from '@/domains/agent-builder/components/agent-builder-edit/conversation-panel';
import { defaultAgentFixture } from '@/domains/agent-builder/fixtures';
import type { AgentFixture } from '@/domains/agent-builder/fixtures';

type LocationState = { userMessage?: string } | null;

export default function AgentBuilderAgentEdit() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state as LocationState) ?? null;
  const [agent, setAgent] = useState<AgentFixture>(defaultAgentFixture);
  const [draftName, setDraftName] = useState<string>(defaultAgentFixture.name);
  const [draftAvatarUrl, setDraftAvatarUrl] = useState<string>(defaultAgentFixture.avatarUrl ?? '');
  const navigate = useNavigate();
  const previewAgent = { ...agent, name: draftName, avatarUrl: draftAvatarUrl.trim() || undefined };
  return (
    <div className="flex flex-1 min-h-0 h-full bg-surface1">
      <div className="flex w-[40ch] shrink-0 flex-col bg-surface1 py-6 px-6">
        <ConversationPanel initialUserMessage={state?.userMessage} />
      </div>
      <div className="flex flex-1 min-w-0 flex-col py-6 pr-6">
        <BrowserFrame className="grid grid-cols-[1fr_380px] relative">
          <div className="h-full w-full overflow-hidden">
            <div className="absolute top-6 left-6 right-0 bottom-0">
              <IconButton
                tooltip="View agent"
                className="rounded-full"
                onClick={() => navigate(`/agent-builder/agents/${id}/view`, { viewTransition: true })}
              >
                <EyeIcon />
              </IconButton>
            </div>
            <AgentPreviewChat agent={previewAgent} />
          </div>

          <div
            className="h-full overflow-y-auto pr-6 pb-6 pt-6"
            style={{ viewTransitionName: 'agent-builder-configure-panel' }}
          >
            <AgentConfigurePanel
              agent={agent}
              onAgentChange={setAgent}
              draftName={draftName}
              draftAvatarUrl={draftAvatarUrl}
              onDraftNameChange={setDraftName}
              onDraftAvatarUrlChange={setDraftAvatarUrl}
            />
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
}
