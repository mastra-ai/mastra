import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { DiffStat } from '../DiffStat';
import { diffMarkdown } from './diff-markdown';
import { MarkdownDiff } from './markdown-diff';

const BEFORE = `Write like a friendly vendor who knows the product.

## Do

- Use the customer’s first name.
- Lead with the answer, then the detail.

## Don’t

- Promise dates, prices or refunds.`;

const AFTER = `Write like a colleague who knows the account, not like a vendor.

## Do

- Use the customer’s first name and plain words.
- Lead with the answer, then the detail.
- Name the next step and who owns it.

## Don’t

- Promise dates, prices or refunds.
- Use “just”, “simply” or exclamation marks.`;

const meta = {
  title: 'Composite/MarkdownDiff',
  component: MarkdownDiff,
  parameters: {
    docs: {
      description: {
        component:
          'Shows how a markdown document changed, as the rendered text with removed words struck through and added words underlined. It renders through `MarkdownRenderer`, so headings, lists and code keep their formatting. Use it to compare versions of prose such as prompts and skills; use `CodeDiff` for code.',
      },
    },
  },
  args: { before: BEFORE, after: AFTER },
} satisfies Meta<typeof MarkdownDiff>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: args => (
    <div className="max-w-170">
      <MarkdownDiff {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('colleague')).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('li')).toHaveLength(5);
  },
};

export const WithChangeCount: Story = {
  render: args => {
    const { additions, deletions } = diffMarkdown(args.before, args.after);
    return (
      <div className="flex max-w-170 flex-col gap-4">
        <DiffStat additions={additions} deletions={deletions} />
        <MarkdownDiff {...args} />
      </div>
    );
  },
};

export const NoChanges: Story = {
  args: { before: AFTER, after: AFTER },
};
