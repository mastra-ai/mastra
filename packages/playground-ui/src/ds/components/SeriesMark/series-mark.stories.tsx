import type { Meta, StoryObj } from '@storybook/react-vite';
import { SeriesMark } from './series-mark';
import { ProviderLogo } from '@/domains/llm';

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

/** A provider logo in the series color on a square tinted with it. */
export const WithLogo: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <SeriesMark color="var(--chart-green)" icon={<ProviderLogo providerId="anthropic" size={14} />} />
      <SeriesMark color="var(--chart-blue)" icon={<ProviderLogo providerId="openai" size={14} />} />
      <SeriesMark color="var(--chart-pink)" icon={<ProviderLogo providerId="google" size={14} />} />
      <SeriesMark color="var(--chart-amber)" />
    </div>
  ),
};
