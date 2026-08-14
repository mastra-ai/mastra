import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { TooltipProvider } from '../Tooltip';
import { MarkdownRenderer } from './markdown-renderer';
import { useSmoothText } from '@/hooks/use-smooth-text';

const meta: Meta<typeof MarkdownRenderer> = {
  title: 'Composite/MarkdownRenderer',
  component: MarkdownRenderer,
  decorators: [
    Story => (
      <TooltipProvider>
        <div className="w-150 p-4">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
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

const STREAMED_REPLY = `Here is what I found in the router.

The redirect runs before the session is read, so a signed-in visitor is sent to
the login page and back again.

\`\`\`ts
if (!session) return redirect('/login');
\`\`\`

Moving the guard below the loader fixes it.`;

/** Chunks land in clumps, the way a proxy flushes them, not one word at a time. */
function useReplay(reply: string): string {
  const [text, setText] = useState('');

  useEffect(() => {
    let landed = 0;
    const timer = setInterval(() => {
      landed = Math.min(reply.length, landed + 12 + Math.floor(Math.random() * 45));
      setText(reply.slice(0, landed));
      if (landed === reply.length) clearInterval(timer);
    }, 130);

    return () => clearInterval(timer);
  }, [reply]);

  return text;
}

function CadenceColumns() {
  const arriving = useReplay(STREAMED_REPLY);
  const revealed = useSmoothText(arriving);

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <p className="text-icon3 text-ui-xs mb-2">As it arrives</p>
        <MarkdownRenderer streaming>{arriving}</MarkdownRenderer>
      </div>
      <div>
        <p className="text-icon3 text-ui-xs mb-2">Smoothed</p>
        <MarkdownRenderer streaming={revealed !== STREAMED_REPLY}>{revealed}</MarkdownRenderer>
      </div>
    </div>
  );
}

function StreamCadence() {
  const [run, setRun] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setRun(count => count + 1)}
        className="text-icon5 border-border1 text-ui-sm self-start rounded-md border px-3 py-1"
      >
        Replay
      </button>
      <CadenceColumns key={run} />
    </div>
  );
}

/** Both columns read the same clumpy stream, so only the cadence differs. */
export const Streaming: Story = {
  render: () => <StreamCadence />,
};
