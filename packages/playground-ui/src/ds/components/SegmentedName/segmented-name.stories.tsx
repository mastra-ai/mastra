import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedName } from './segmented-name';
import { Txt } from '@/ds/components/Txt';

const meta: Meta<typeof SegmentedName> = {
  title: 'DataDisplay/SegmentedName',
  component: SegmentedName,
  parameters: { layout: 'centered' },
  render: args => (
    <Txt as="span" variant="body-sm">
      <SegmentedName {...args} />
    </Txt>
  ),
};

export default meta;
type Story = StoryObj<typeof SegmentedName>;

/** A model with its provider. */
export const Model: Story = { args: { parts: ['openai', 'gpt-5-mini'] } };

/** A span's kind and value, as the traces timeline names spans. */
export const Span: Story = { args: { parts: ['agent run', 'Code Agent'] } };
