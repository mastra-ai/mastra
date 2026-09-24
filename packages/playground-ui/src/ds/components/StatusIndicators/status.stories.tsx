import type { Meta, StoryObj } from '@storybook/react-vite';
import { Status } from './status';
import { Txt } from '@/ds/components/Txt';

const RUNNING = {
  label: 'Ready',
  tone: 'success',
  description: 'The server is live and responding to requests.',
} as const;

const meta: Meta<typeof Status> = {
  title: 'Feedback/StatusIndicators',
  component: Status,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The label inherits the surrounding text size and color by default, so it matches its siblings in a DataList cell, table row, or sentence. Pass `textVariant` with a `TextRole` (for example `meta` in a card or header) when the container sets no text style or the label needs its own level. Pass `children` for custom content.',
      },
    },
  },
  args: {
    presentation: RUNNING,
  },
  argTypes: {
    children: { control: false },
    textVariant: { control: 'select' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TextVariants: Story = {
  render: () => (
    <main className="flex flex-col gap-4">
      <h1 className="sr-only">Status text variants</h1>
      <div className="flex items-center gap-4">
        <Txt as="span" variant="caption" tone="muted" className="w-40">
          textVariant="meta"
        </Txt>
        <Status presentation={RUNNING} textVariant="meta" />
      </div>
      <div className="flex items-center gap-4">
        <Txt as="span" variant="caption" tone="muted" className="w-40">
          textVariant="body-sm"
        </Txt>
        <Status presentation={RUNNING} textVariant="body-sm" />
      </div>
      <div className="flex items-center gap-4">
        <Txt as="span" variant="caption" tone="muted" className="w-40">
          Default (inherit)
        </Txt>
        <span className="text-meta text-muted-foreground">
          <Status presentation={RUNNING} />
        </span>
      </div>
    </main>
  ),
};
