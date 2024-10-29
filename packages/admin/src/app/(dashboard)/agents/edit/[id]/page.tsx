import { ResolvingMetadata, Metadata } from 'next';

import { Icon } from '@/components/icon';
import { ScrollArea } from '@/components/ui/scroll-area';

import { getAgent } from '@/domains/agents/actions';
import { AgentFormButton } from '@/domains/agents/components/agent-form-button';
import { AgentInfoForm } from '@/domains/agents/components/agents-info-form';
import { AgentTools } from '@/domains/agents/components/agents-tools';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params, searchParams }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  // read route params
  const id = (await params).id;

  const agent = await getAgent(id);

  return {
    title: `Edit - ${agent?.name || ''}`,
    description: `Edit agent - ${agent?.name || ''}`,
  };
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const agent = await getAgent(params.id);
  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex h-[var(--top-bar-height)] bg-mastra-bg-1 sticky top-0 w-full content-center items-center justify-between border-b-[0.1px] border-mastra-border-1 px-[1.31rem]">
        <div className="h-fit items-center  gap-1.5 flex">
          <span className=" bg-mastra-bg-3 rounded h-7 w-7 grid place-items-center">
            <Icon name="agent" className="w-3 h-3" />
          </span>
          <h1 className="text-base">{agent.name}</h1>
        </div>
      </div>
      <section className="grid flex-1 overflow-hidden gap-x-[0.62rem] grid-cols-[30rem_30rem]">
        <AgentInfoForm />
        <ScrollArea className="flex-1">
          <div className="px-[1.31rem] pb-4 space-y-10 ">
            <AgentTools />

            <AgentFormButton />
          </div>
        </ScrollArea>
      </section>
    </div>
  );
}
