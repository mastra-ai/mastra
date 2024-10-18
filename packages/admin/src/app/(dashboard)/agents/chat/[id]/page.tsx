import Icon from '@/components/icon';

import { getAgent } from '@/domains/agents/actions';
import { AgentChat } from '@/domains/agents/components/agent-chat';

export default async function Page({ params }: { params: { id: string } }) {
  const agent = await getAgent(params.id);
  return (
    <div className="h-full">
      <div className="flex h-[var(--top-bar-height)] bg-mastra-bg-1/50 sticky top-0 w-full content-center items-center justify-between border-b-[0.1px] border-mastra-border-1 px-[1.31rem]">
        <div className="h-fit items-center  gap-1.5 flex">
          <span className=" bg-mastra-bg-3 rounded h-7 w-7 grid place-items-center">
            <Icon name="agent" className="w-3 h-3" />
          </span>
          <h1 className="text-base">Chat with {agent.name}</h1>
        </div>
      </div>
      <AgentChat agentName={agent.name} />
    </div>
  );
}
