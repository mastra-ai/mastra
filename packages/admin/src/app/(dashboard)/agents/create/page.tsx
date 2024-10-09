import { Icon } from '@/app/components/icon';
import { AgentsCreationHeader } from '@/domains/agents/components/agents-creation-header';
import { AgentIntegrations } from '@/domains/agents/components/agents-integrations';

export default function Page() {
  return (
    <div>
      <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-mastra-border-1 px-[1.31rem]">
        <div className="h-fit items-center gap-1.5 flex">
          <span className=" bg-mastra-bg-3 rounded h-7 w-7 grid place-items-center">
            <Icon name="agent" className="w-3 h-3" />
          </span>
          <h1 className="text-base">Create New Agent</h1>
        </div>
      </div>
      <section className="grid h-[calc(100%-1.24rem)] gap-x-[0.62rem] grid-cols-[30rem_0.5px_1fr]">
        <div>
          <AgentsCreationHeader />
          <AgentIntegrations />
        </div>
        some other stuff, (wip)
      </section>
    </div>
  );
}
