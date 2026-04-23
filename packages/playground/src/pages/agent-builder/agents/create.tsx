import { IconButton } from '@mastra/playground-ui';
import { ArrowLeftIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { AgentBuilderStarter } from '@/domains/agent-builder/components/agent-builder-starter/agent-builder-starter';
import { useTools } from '@/domains/tools/hooks/use-all-tools';

export default function AgentBuilderCreate() {
  // Warm the ['tools'] tanstack-query cache while the user types their prompt,
  // so the edit page can dispatch the initial message with a tools-aware schema
  // on its very first render instead of waiting for the query to resolve.
  useTools();
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
