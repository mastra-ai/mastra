import type { Meta, StoryObj } from '@storybook/react-vite';
import { SeriesMark } from './series-mark';
import { ProviderMark } from '@/domains/llm';
import { AgentIcon, ToolsIcon, WorkflowIcon } from '@/ds/icons';

const meta: Meta<typeof SeriesMark> = {
  title: 'Metrics/SeriesMark',
  component: SeriesMark,
  parameters: { layout: 'centered' },
  args: { color: 'var(--chart-green)' },
};

export default meta;
type Story = StoryObj<typeof SeriesMark>;

/** No icon: the series color as a small square, as in chart legends. */
export const Swatch: Story = {};

/** A provider logo (`ProviderMark`, 13px) in the series color on a square tinted with it. */
export const WithLogo: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <ProviderMark provider="anthropic" color="var(--chart-green)" />
      <ProviderMark provider="openai" color="var(--chart-blue)" />
      <ProviderMark provider="google" color="var(--chart-pink)" />
      <SeriesMark color="var(--chart-amber)" />
    </div>
  ),
};

/** No color, for a table without a chart: muted on a neutral square. Entity glyphs at 12px. */
export const Neutral: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <SeriesMark icon={<AgentIcon className="size-3" />} />
      <SeriesMark icon={<WorkflowIcon className="size-3" />} />
      <SeriesMark icon={<ToolsIcon className="size-3" />} />
      <ProviderMark provider="openai" />
    </div>
  ),
};
