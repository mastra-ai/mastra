import { cn, IconButton } from '@mastra/playground-ui';
import { ArrowLeftIcon, Columns2, PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AgentConfigurePanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { AgentPreviewChat } from '@/domains/agent-builder/components/agent-builder-edit/agent-preview-chat';
import { BrowserFrame } from '@/domains/agent-builder/components/agent-builder-edit/browser-frame';

import { defaultAgentFixture } from '@/domains/agent-builder/fixtures';

export default function AgentBuilderAgentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const gridClass = expanded ? 'grid-cols-[1fr_380px]' : 'grid-cols-1';
  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 h-full bg-surface1">
      <BrowserFrame className={cn('grid relative', gridClass)}>
        <div className="h-full w-full overflow-hidden grid grid-rows-[auto_1fr]">
          <div className="flex gap-2 items-center pl-6 pt-6 pr-6 justify-between">
            <div className="flex gap-2 items-center">
              <IconButton
                tooltip="Aents list"
                className="rounded-full"
                onClick={() => navigate(`/agent-builder/agents`)}
              >
                <ArrowLeftIcon />
              </IconButton>
              <IconButton
                tooltip="Edit agent"
                className="rounded-full"
                onClick={() => navigate(`/agent-builder/agents/${id}/edit`, { viewTransition: true })}
              >
                <PencilIcon />
              </IconButton>
            </div>
            {!expanded && (
              <IconButton tooltip="Expand" className="rounded-full" onClick={() => setExpanded(true)}>
                <Columns2 />
              </IconButton>
            )}
          </div>

          <AgentPreviewChat agent={defaultAgentFixture} />
        </div>

        {expanded && (
          <div
            className="h-full overflow-y-auto pr-6 pb-6 pt-6"
            style={{ viewTransitionName: 'agent-builder-configure-panel' }}
          >
            <AgentConfigurePanel
              agent={defaultAgentFixture}
              onAgentChange={() => {}}
              editable={false}
              onClose={() => setExpanded(false)}
            />
          </div>
        )}
      </BrowserFrame>
    </div>
  );
}
