import { ResolvingMetadata, Metadata } from 'next';

import Icon from '@/components/icon';

import { getAgent } from '@/domains/agents/actions';
import { AgentChat } from '@/domains/agents/components/agent-chat';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params, searchParams }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  // read route params
  const id = (await params).id;

  const agent = await getAgent(id);

  return {
    title: `Chat - ${agent?.name || ''}`,
    description: `Chat with agent - ${agent?.name || ''}`,
  };
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
