import type { Meta, StoryObj } from '@storybook/react-vite';
import { Header, HeaderTitle } from './ds/components/Header/Header';
import { CodeBlock } from './ds/components/CodeBlock/code-block';
import { WorkflowDebugControls } from './ds/components/Workflow/controls/workflow-debug-controls';
import { CommandComposer } from '../.storybook/fixtures/command-composer';
import { SidebarPanel } from '__CHECKOUT_ROOT__/packages/playground/src/domains/agents/components/sidebar-panel';
import { InlineWorkItemComposer } from '__CHECKOUT_ROOT__/mastracode/factory-ui/src/ui/domains/factory/components/InlineWorkItemComposer';
import { TooltipProvider } from './ds/components/Tooltip';
import { Txt } from './ds/components/Txt';

const meta: Meta = { title: 'Evidence/Border call sites', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;
const noop = () => {};
export const CallSites: Story = {
 render: () => (
  <TooltipProvider>
   <div className="bg-background p-8" data-testid="callsite-evidence">
    <Txt as="h1" variant="title">Border changes at component call sites</Txt>
    <Txt variant="body-sm" tone="muted" className="mt-2 mb-7">Identical fixtures using the real components from each revision.</Txt>
    <div className="grid grid-cols-2 items-start gap-8">
     <div className="flex flex-col gap-7">
      <section data-example="header">
       <Txt variant="label" className="mb-3">Content header</Txt>
       <Header><HeaderTitle>Templates</HeaderTitle></Header>
      </section>
      <section data-example="composer">
       <Txt variant="label" className="mb-3">Composer and command dividers</Txt>
       <CommandComposer initialValue="/review " />
      </section>
      <section data-example="codeblock">
       <Txt variant="label" className="mb-3">Code block edge and filename divider</Txt>
       <CodeBlock fileName="agent.ts" code={'const agent = new Agent({\n  name: "Research agent",\n  model: "openai/gpt-4o-mini",\n});'} />
      </section>
     </div>
     <div className="flex flex-col gap-7">
      <section data-example="sidebar">
       <Txt variant="label" className="mb-3">Studio sidebar panel edge</Txt>
       <div className="bg-background h-32 p-2">
        <SidebarPanel><div className="p-4"><Txt variant="subheading">Agent memory</Txt><Txt variant="body-sm" tone="muted" className="mt-2">Recent conversations and memory configuration</Txt></div></SidebarPanel>
       </div>
      </section>
      <section data-example="workflow">
       <Txt variant="label" className="mb-3">Workflow debug panel edge</Txt>
       <WorkflowDebugControls canRunNextStep nextStepLabel="check-inventory" onRunNextStep={noop} onContinueRun={noop} />
      </section>
      <section data-example="factory">
       <Txt variant="label" className="mb-3">Factory work-item composer edge</Txt>
       <InlineWorkItemComposer stage="intake" stageLabel="Intake" onCreate={async () => {}} onClose={noop} />
      </section>
     </div>
    </div>
   </div>
  </TooltipProvider>
 ),
};
