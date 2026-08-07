import type { Meta, StoryObj } from '@storybook/react-vite';

import { Code } from './code';

const meta: Meta<typeof Code> = {
  title: 'Elements/Code',
  component: Code,
  decorators: [
    Story => (
      <div className="text-ui-sm text-neutral5 w-full p-4 font-mono">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Low-level shiki token renderer shared by `CodeBlock` and `MarkdownRenderer`. Renders a bare `<pre><code>` with CSS-driven dual-theme colors (`.shiki-token` + `--shiki-light`/`--shiki-dark` variables) — no chrome, no copy button. Prefer `CodeBlock` unless you are building a custom code surface.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Code>;

const tsSnippet = `import { Agent } from '@mastra/core/agent';\n\nexport const agent = new Agent({\n  name: 'assistant',\n  instructions: 'You are a helpful assistant.',\n});`;

export const Default: Story = {
  render: () => <Code code={tsSnippet} lang="typescript" />,
};

export const PlainFallback: Story = {
  render: () => <Code code="No language given, rendered as plain text." />,
};

export const Json: Story = {
  render: () => (
    <Code code={`{\n  "name": "weather-agent",\n  "tools": ["weatherTool"],\n  "memory": true\n}`} lang="json" />
  ),
};

export const Python: Story = {
  render: () => <Code code={`def forecast(city: str) -> dict:\n    return {"city": city, "temp": 21}`} lang="python" />,
};
