import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronDown, Settings } from 'lucide-react';
import { Accordion, AccordionContent, AccordionSummary } from './accordion';

const meta: Meta<typeof Accordion> = {
  title: 'Layout/Accordion',
  component: Accordion,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Accordion>;

export const Default: Story = {
  render: () => (
    <Accordion className="w-[400px]">
      <AccordionSummary>Click to expand</AccordionSummary>
      <AccordionContent>
        This is the accordion content. It uses the native HTML <code>&lt;details&gt;</code> element, so the
        collapse/expand behavior is entirely driven by the browser — no JavaScript state.
      </AccordionContent>
    </Accordion>
  ),
};

export const DefaultOpen: Story = {
  render: () => (
    <Accordion open className="w-[400px]">
      <AccordionSummary>Open by default</AccordionSummary>
      <AccordionContent>
        Pass the native <code>open</code> attribute to start in the expanded state.
      </AccordionContent>
    </Accordion>
  ),
};

/**
 * Multiple `<Accordion>`s sharing the same `name` form an exclusive
 * group per the HTML spec: opening one collapses the others. This
 * is the main reason this component exists.
 */
export const ExclusiveGroup: Story = {
  render: () => (
    <div className="w-[400px] flex flex-col gap-2">
      <Accordion name="faq">
        <AccordionSummary>What is Mastra?</AccordionSummary>
        <AccordionContent>Mastra is the TypeScript agent framework.</AccordionContent>
      </Accordion>
      <Accordion name="faq">
        <AccordionSummary>How do I install it?</AccordionSummary>
        <AccordionContent>
          Run <code>npm create mastra@latest</code> and follow the prompts.
        </AccordionContent>
      </Accordion>
      <Accordion name="faq">
        <AccordionSummary>Where can I get help?</AccordionSummary>
        <AccordionContent>Join the Mastra Discord or open a discussion on GitHub.</AccordionContent>
      </Accordion>
    </div>
  ),
};

export const CustomClassName: Story = {
  render: () => (
    <Accordion className="w-[400px] border-accent1">
      <AccordionSummary className="bg-surface4 group-open:bg-surface3 text-accent1">
        Custom-styled summary
      </AccordionSummary>
      <AccordionContent className="bg-surface2 text-neutral6">
        Each slot accepts a <code>className</code> that is merged on top of the defaults via <code>cn</code>.
      </AccordionContent>
    </Accordion>
  ),
};

export const WithRichContent: Story = {
  render: () => (
    <Accordion className="w-[400px]">
      <AccordionSummary>
        <span className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Advanced settings
        </span>
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </AccordionSummary>
      <AccordionContent>
        <ul className="flex flex-col gap-2">
          <li className="flex items-center justify-between">
            <span>Debug mode</span>
            <span className="text-neutral3">Disabled</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Verbose logging</span>
            <span className="text-neutral3">Off</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Cache timeout</span>
            <span className="text-neutral3">300s</span>
          </li>
        </ul>
      </AccordionContent>
    </Accordion>
  ),
};
