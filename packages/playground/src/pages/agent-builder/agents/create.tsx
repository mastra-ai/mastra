import { IconButton } from '@mastra/playground-ui';
import { ArrowLeftIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { AgentBuilderStarter } from '@/domains/agent-builder/components/agent-builder-starter/agent-builder-starter';

export default function AgentBuilderCreate() {
  const navigate = useNavigate();
  return (
    <>
      <div className="absolute top-6 left-6 z-10">
        <IconButton
          onClick={() =>
            navigate('/agent-builder/agents', {
              viewTransition: true,
            })
          }
          className="rounded-full"
          tooltip="Agents list"
        >
          <ArrowLeftIcon />
        </IconButton>
      </div>
      <AgentBuilderStarter />
    </>
  );
}
