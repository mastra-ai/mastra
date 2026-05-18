import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronDown, Settings } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionSummary } from './accordion';

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
      <AccordionItem value="one">
        <AccordionSummary>Click to expand</AccordionSummary>
        <AccordionContent>
          This accordion is built on top of <code>@base-ui/react</code>’s Accordion primitives. Each
          item is wired through the root <code>value</code> / <code>onValueChange</code> API.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const DefaultOpen: Story = {
  render: () => (
    <Accordion className="w-[400px]" defaultValue={['one']}>
      <AccordionItem value="one">
        <AccordionSummary>Open by default</AccordionSummary>
        <AccordionContent>
          Pass the item’s <code>value</code> in the root’s <code>defaultValue</code> to start open.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

/**
 * The root only keeps one item open at a time by default. Multiple items can
 * coexist inside the same root to form an exclusive group.
 */
export const ExclusiveGroup: Story = {
  render: () => (
    <Accordion className="w-[400px]">
      <AccordionItem value="what">
        <AccordionSummary>What is Mastra?</AccordionSummary>
        <AccordionContent>Mastra is the TypeScript agent framework.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="install">
        <AccordionSummary>How do I install it?</AccordionSummary>
        <AccordionContent>
          Run <code>npm create mastra@latest</code> and follow the prompts.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="help">
        <AccordionSummary>Where can I get help?</AccordionSummary>
        <AccordionContent>Join the Mastra Discord or open a discussion on GitHub.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const CustomClassName: Story = {
  render: () => (
    <Accordion className="w-[400px] border-accent1">
      <AccordionItem value="one">
        <AccordionSummary className="bg-surface4 data-[panel-open]:bg-surface3 text-accent1">
          Custom-styled summary
        </AccordionSummary>
        <AccordionContent className="bg-surface2 text-neutral6">
          Each slot accepts a <code>className</code> that is merged on top of the defaults via{' '}
          <code>cn</code>.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const WithRichContent: Story = {
  render: () => (
    <Accordion className="w-[400px]">
      <AccordionItem value="settings">
        <AccordionSummary>
          <span className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Advanced settings
          </span>
          <ChevronDown className="h-4 w-4 transition-transform group-data-[panel-open]/accordion-summary:rotate-180" />
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
      </AccordionItem>
    </Accordion>
  ),
};
