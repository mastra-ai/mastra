import { cn, IconButton } from '@mastra/playground-ui';
import { Columns2, EyeIcon } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();
  const previewAgent = { ...agent, name: draftName, avatarUrl: draftAvatarUrl.trim() || undefined };

  const gridClass = expanded ? 'grid-cols-[1fr_380px]' : 'grid-cols-[1fr_0px]';

  return (
    <div className="flex flex-1 min-h-0 h-full bg-surface1">
      <div className="flex w-[40ch] shrink-0 flex-col bg-surface1 py-6 px-6">
        <ConversationPanel initialUserMessage={state?.userMessage} />
      </div>
      <div className="flex flex-1 min-w-0 flex-col py-6 pr-6">
        <BrowserFrame className={cn('grid relative agent-builder-panel-grid', gridClass)}>
          <div className="h-full w-full overflow-hidden grid grid-rows-[auto_1fr]">
            <div className="flex gap-2 items-center pl-6 pt-6 pr-6 justify-between">
              <IconButton
                tooltip="View agent"
                className="rounded-full"
                onClick={() => navigate(`/agent-builder/agents/${id}/view`, { viewTransition: true })}
              >
                <EyeIcon />
              </IconButton>

              {!expanded && (
                <IconButton tooltip="Expand" className="rounded-full" onClick={() => setExpanded(true)}>
                  <Columns2 />
                </IconButton>
              )}
            </div>

            <AgentPreviewChat agent={previewAgent} />
          </div>

          <div className="h-full min-w-0 overflow-hidden" aria-hidden={!expanded}>
            <div
              className={cn(
                'agent-builder-panel-slide h-full w-[380px] overflow-y-auto pr-6 pb-6 pt-6',
                expanded ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0 pointer-events-none',
              )}
              style={expanded ? { viewTransitionName: 'agent-builder-configure-panel' } : undefined}
            >
              <AgentConfigurePanel
                agent={agent}
                onAgentChange={setAgent}
                draftName={draftName}
                draftAvatarUrl={draftAvatarUrl}
                onDraftNameChange={setDraftName}
                onDraftAvatarUrlChange={setDraftAvatarUrl}
                onClose={() => setExpanded(false)}
              />
            </div>
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
}
