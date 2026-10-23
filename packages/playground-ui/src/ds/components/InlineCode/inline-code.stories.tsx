import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeBlock } from '../CodeBlock/code-block';
import { Txt } from '../Txt/Txt';
import { InlineCode } from './inline-code';

const meta: Meta<typeof InlineCode> = {
  title: 'Elements/InlineCode',
  component: InlineCode,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof InlineCode>;

export const Default: Story = {
  args: {
    children: 'workspace.init()',
  },
};

/**
 * Inline code takes the size of the text around it, so one component works in body copy,
 * captions, and table cells.
 */
export const InText: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <Txt variant="body">
        Add <InlineCode>@mastra/observability</InlineCode> to enable traces.
      </Txt>
      <Txt variant="body-sm" tone="muted">
        Set <InlineCode>OPENAI_API_KEY</InlineCode> to use this model.
      </Txt>
      <Txt variant="caption" tone="muted">
        Use <InlineCode>{'{{variableName}}'}</InlineCode> to insert a variable.
      </Txt>
    </div>
  ),
};

/** Code that runs past one line is a highlighted `CodeBlock`, not inline code. */
export const WithCodeBlock: Story = {
  render: () => (
    <div className="flex w-120 flex-col gap-3">
      <Txt variant="body" tone="muted">
        Call <InlineCode>agent.generate()</InlineCode> with the ticket text:
      </Txt>
      <CodeBlock
        lang="ts"
        code={"const result = await agent.generate('Summarize the ticket');\nconsole.log(result.text);"}
      />
    </div>
  ),
};
