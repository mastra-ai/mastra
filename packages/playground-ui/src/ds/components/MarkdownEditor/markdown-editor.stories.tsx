import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TooltipProvider } from '../Tooltip';
import { MarkdownEditor } from './markdown-editor';
import type { MarkdownEditorProps } from './markdown-editor';

const instructions = `# Review a pull request

Read the **whole diff** before commenting, and keep each note *specific*.

## Steps

- Run \`pnpm test\` for the touched package
- Check the [contributing guide](https://mastra.ai/docs) for naming
- Flag missing changesets

> Ask for context when the intent is unclear.

---

\`\`\`ts
const verdict = approve ? 'approve' : 'request changes';
\`\`\`
`;

function ControlledMarkdownEditor(props: MarkdownEditorProps) {
  const [value, setValue] = useState(props.value);
  return <MarkdownEditor {...props} value={value} onChange={setValue} />;
}

const meta: Meta<typeof MarkdownEditor> = {
  title: 'Composite/MarkdownEditor',
  component: MarkdownEditor,
  render: args => <ControlledMarkdownEditor {...args} />,
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'inline'],
    },
    editable: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MarkdownEditor>;

export const Default: Story = {
  args: {
    value: instructions,
    'aria-label': 'Instructions',
    className: 'max-w-[560px]',
  },
};

export const Inline: Story = {
  args: {
    ...Default.args,
    variant: 'inline',
  },
};

export const Empty: Story = {
  args: {
    value: '',
    placeholder: 'Write the instructions agents follow',
    'aria-label': 'Instructions',
    className: 'max-w-[560px]',
  },
  parameters: {
    docs: {
      description: {
        story: 'Type `/` at the start of a line for block types, or select text for formatting.',
      },
    },
  },
};

export const ReadOnly: Story = {
  args: {
    ...Default.args,
    editable: false,
  },
};
