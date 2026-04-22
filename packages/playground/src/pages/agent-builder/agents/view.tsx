import { IconButton } from '@mastra/playground-ui';
import { PencilIcon } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { AgentConfigurePanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { AgentPreviewChat } from '@/domains/agent-builder/components/agent-builder-edit/agent-preview-chat';
import { BrowserFrame } from '@/domains/agent-builder/components/agent-builder-edit/browser-frame';

import { defaultAgentFixture } from '@/domains/agent-builder/fixtures';

export default function AgentBuilderAgentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 h-full bg-surface1">
      <BrowserFrame className="grid grid-cols-[1fr_380px] relative">
        <div className="h-full w-full overflow-hidden">
          <div className="absolute top-6 left-6 right-0 bottom-0">
            <IconButton
              tooltip="Edit agent"
              className="rounded-full"
              onClick={() => navigate(`/agent-builder/agents/${id}/edit`, { viewTransition: true })}
            >
              <PencilIcon />
            </IconButton>
          </div>
          <AgentPreviewChat agent={defaultAgentFixture} />
        </div>

        <div
          className="h-full overflow-y-auto pr-6 pb-6 pt-6"
          style={{ viewTransitionName: 'agent-builder-configure-panel' }}
        >
          <AgentConfigurePanel agent={defaultAgentFixture} onAgentChange={() => {}} editable={false} />
        </div>
      </BrowserFrame>
    </div>
  );
}
