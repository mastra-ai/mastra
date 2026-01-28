import type { Meta, StoryObj } from '@storybook/react-vite';
import { Truncate } from './truncate';
import { TooltipProvider } from '../Tooltip';

const meta: Meta<typeof Truncate> = {
  title: 'Elements/Truncate',
  component: Truncate,
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Truncate>;

export const Default: Story = {
  args: {
    children: 'Short text',
  },
};

export const TruncateByCharCount: Story = {
  args: {
    children: 'This is a very long text that should be truncated after a certain number of characters',
    charCount: 20,
  },
};

export const TruncateByDelimiter: Story = {
  args: {
    children: 'workflow-run-abc123-def456-ghi789',
    untilChar: '-',
  },
};

export const WithCopyButton: Story = {
  args: {
    children: 'This is a very long text that should be truncated',
    charCount: 15,
    copy: true,
  },
};

export const WithoutTooltip: Story = {
  args: {
    children: 'This is a very long text that should be truncated',
    charCount: 15,
    withTooltip: false,
  },
};

export const WithoutTooltipWithCopy: Story = {
  args: {
    children: 'This is a very long text that should be truncated',
    charCount: 15,
    withTooltip: false,
    copy: true,
  },
};

export const LongTextWithTooltip: Story = {
  args: {
    children:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    charCount: 30,
  },
};

export const UUIDTruncation: Story = {
  args: {
    children: '550e8400-e29b-41d4-a716-446655440000',
    charCount: 8,
    copy: true,
  },
};

export const NoTruncationNeeded: Story = {
  args: {
    children: 'Short',
    charCount: 100,
  },
};

export const DelimiterNotFound: Story = {
  args: {
    children: 'no-delimiter-present',
    untilChar: '@',
  },
};

export const WithMonoFont: Story = {
  args: {
    children: '550e8400-e29b-41d4-a716-446655440000',
    charCount: 8,
    font: 'mono',
    copy: true,
  },
};

export const WithVariant: Story = {
  args: {
    children: 'This is a header that gets truncated',
    charCount: 20,
    variant: 'header-md',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-neutral4 text-sm w-32">No truncation:</span>
        <Truncate>Short text</Truncate>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-neutral4 text-sm w-32">By char count:</span>
        <Truncate charCount={20}>This is a very long text that needs truncation</Truncate>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-neutral4 text-sm w-32">By delimiter:</span>
        <Truncate untilChar="-">workflow-run-12345</Truncate>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-neutral4 text-sm w-32">With copy:</span>
        <Truncate charCount={10} copy>
          Copy this long text
        </Truncate>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-neutral4 text-sm w-32">Mono font:</span>
        <Truncate charCount={8} font="mono" copy>
          550e8400-e29b-41d4
        </Truncate>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-neutral4 text-sm w-32">Header variant:</span>
        <Truncate charCount={15} variant="header-sm">
          Large header text truncated
        </Truncate>
      </div>
    </div>
  ),
};
