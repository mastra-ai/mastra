import type { Meta, StoryObj } from '@storybook/react-vite';
import { GrainFill } from './grain-fill';

const meta: Meta<typeof GrainFill> = {
  title: 'Elements/GrainFill',
  component: GrainFill,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof GrainFill>;

const tones = ['warning', 'destructive', 'info', 'success'] as const;

export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {tones.map(tone => (
        <div
          key={tone}
          className="relative isolate h-50 w-116 max-w-full overflow-hidden rounded-2xl border border-surface-rim bg-card shadow-(--elevation-raised)"
        >
          <GrainFill tone={tone} width={464} height={200} className="absolute inset-0 -z-10" />
        </div>
      ))}
    </div>
  ),
};

const colorTokens = ['brand-purple', 'product-studio', 'chart-pink', 'span-workflow'] as const;

export const AnyColorToken: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {colorTokens.map(tone => (
        <div
          key={tone}
          className="relative isolate h-50 w-116 max-w-full overflow-hidden rounded-2xl border border-surface-rim bg-card shadow-(--elevation-raised)"
        >
          <GrainFill tone={tone} width={464} height={200} className="absolute inset-0 -z-10" />
        </div>
      ))}
    </div>
  ),
};
