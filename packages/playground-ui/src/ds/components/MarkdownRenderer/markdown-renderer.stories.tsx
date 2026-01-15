import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkdownRenderer } from './markdown-renderer';
import { TooltipProvider } from '../Tooltip';

const meta: Meta<typeof MarkdownRenderer> = {
  title: 'Composite/MarkdownRenderer',
  component: MarkdownRenderer,
  decorators: [
    Story => (
      <TooltipProvider>
        <div className="w-[600px] p-4">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MarkdownRenderer>;

export const Default: Story = {
  args: {
    children: 'This is a simple paragraph of **markdown** text with some *emphasis*.',
  },
};

export const Headings: Story = {
  args: {
    children: `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5

Regular paragraph text.`,
  },
};

export const Lists: Story = {
  args: {
    children: `## Unordered List
- First item
- Second item
- Third item with **bold**

## Ordered List
1. Step one
2. Step two
3. Step three`,
  },
};

export const CodeBlocks: Story = {
  args: {
    children: `Here's an inline \`code\` example.

\`\`\`javascript
const agent = new Agent({
  name: 'MyAgent',
  model: 'gpt-4',
  temperature: 0.7,
});

await agent.run('Hello, world!');
\`\`\`

And here's some Python:

\`\`\`python
def greet(name):
    return f"Hello, {name}!"
\`\`\``,
  },
};

export const Links: Story = {
  args: {
    children: `Check out the [Mastra documentation](https://mastra.ai/docs) for more information.

You can also visit [GitHub](https://github.com) for source code.`,
  },
};

export const Blockquotes: Story = {
  args: {
    children: `> This is a blockquote that contains some important information.
> It can span multiple lines.

Regular text after the quote.`,
  },
};

export const Tables: Story = {
  args: {
    children: `## Agent Comparison

| Agent Name | Model | Temperature | Max Tokens |
|------------|-------|-------------|------------|
| Support | GPT-4 | 0.7 | 4096 |
| Sales | GPT-4-Turbo | 0.5 | 2048 |
| Research | Claude-3 | 0.9 | 8192 |`,
  },
};

export const ComplexDocument: Story = {
  args: {
    children: `# Getting Started with Mastra

Mastra is a **powerful framework** for building AI agents.

## Installation

First, install the package:

\`\`\`bash
npm install @mastra/core
\`\`\`

## Quick Start

Here's a simple example:

\`\`\`typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'MyAgent',
  model: 'gpt-4',
});
\`\`\`

## Features

- **Easy setup** - Get started in minutes
- **Flexible** - Works with any LLM
- **Extensible** - Add custom tools and integrations

> Note: Make sure you have your API keys configured before running.

For more details, check out the [documentation](https://mastra.ai/docs).`,
  },
};

export const HorizontalRule: Story = {
  args: {
    children: `## Section One

Some content here.

---

## Section Two

More content after the divider.`,
  },
};
