import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { TooltipProvider } from '../Tooltip';
import { CodeBlock } from './code-block';

const meta: Meta<typeof CodeBlock> = {
  title: 'Composite/CodeBlock',
  component: CodeBlock,
  decorators: [
    Story => (
      <TooltipProvider>
        <div className="w-full p-4">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof CodeBlock>;

const packageManagers = [
  { label: 'pnpm', value: 'pnpm' },
  { label: 'npm', value: 'npm' },
  { label: 'yarn', value: 'yarn' },
  { label: 'bun', value: 'bun' },
];

const commands: Record<string, string> = {
  pnpm: 'pnpm add @mastra/core@latest @mastra/memory@latest mastra@latest',
  npm: 'npm install @mastra/core@latest @mastra/memory@latest mastra@latest',
  yarn: 'yarn add @mastra/core@latest @mastra/memory@latest mastra@latest',
  bun: 'bun add @mastra/core@latest @mastra/memory@latest mastra@latest',
};

export const Default: Story = {
  render: () => <CodeBlock code="pnpm dlx mastra@latest init" />,
};

export const WithSelect: Story = {
  render: () => {
    const [pm, setPm] = useState('pnpm');
    return (
      <CodeBlock
        code={commands[pm]}
        options={packageManagers}
        value={pm}
        onValueChange={setPm}
        copyMessage="Copied update command!"
      />
    );
  },
};

export const LongCommand: Story = {
  render: () => {
    const [pm, setPm] = useState('pnpm');
    const long = `${pm} add @mastra/auth-workos@latest @mastra/client-js@latest @mastra/core@latest @mastra/duckdb@latest @mastra/editor@latest @mastra/libsql@latest @mastra/mcp@latest @mastra/memory@latest @mastra/observability@latest @mastra/slack@latest mastra@latest`;
    return <CodeBlock code={long} options={packageManagers} value={pm} onValueChange={setPm} />;
  },
};

export const WithFileName: Story = {
  render: () => (
    <CodeBlock
      fileName="src/mastra/agents/index.ts"
      lang="typescript"
      code={`import { Agent } from '@mastra/core/agent';\nimport { openai } from '@ai-sdk/openai';\n\nexport const agent = new Agent({\n  name: 'assistant',\n  model: openai('gpt-4o-mini'),\n});`}
    />
  ),
};

export const WithTabs: Story = {
  render: () => {
    const [pm, setPm] = useState('pnpm');
    return (
      <CodeBlock
        code={commands[pm]}
        options={packageManagers}
        value={pm}
        onValueChange={setPm}
        selector="tabs"
        copyMessage="Copied update command!"
      />
    );
  },
};

export const TabsWithCode: Story = {
  render: () => {
    const [provider, setProvider] = useState('anthropic');
    const snippets: Record<string, string> = {
      anthropic: `import { anthropic } from '@ai-sdk/anthropic';\n\nconst model = anthropic('claude-sonnet-4-5');`,
      openai: `import { openai } from '@ai-sdk/openai';\n\nconst model = openai('gpt-4o-mini');`,
      langchain: `import { ChatOpenAI } from '@langchain/openai';\n\nconst model = new ChatOpenAI({ model: 'gpt-4o-mini' });`,
      mastra: `import { Agent } from '@mastra/core/agent';\n\nexport const agent = new Agent({ name: 'assistant', model });`,
    };
    return (
      <CodeBlock
        code={snippets[provider]}
        lang="typescript"
        selector="tabs"
        options={[
          { label: 'Anthropic', value: 'anthropic' },
          { label: 'OpenAI', value: 'openai' },
          { label: 'LangChain', value: 'langchain' },
          { label: 'Mastra', value: 'mastra' },
        ]}
        value={provider}
        onValueChange={setProvider}
      />
    );
  },
};

export const Highlighted: Story = {
  render: () => {
    const [provider, setProvider] = useState('openai');
    const snippets: Record<string, string> = {
      openai: `import { openai } from '@ai-sdk/openai';\n\nconst model = openai('gpt-4o-mini');`,
      anthropic: `import { anthropic } from '@ai-sdk/anthropic';\n\nconst model = anthropic('claude-sonnet-4-5');`,
      mastra: `import { Agent } from '@mastra/core/agent';\n\nexport const agent = new Agent({ name: 'assistant', model });`,
    };
    return (
      <CodeBlock
        code={snippets[provider]}
        lang="typescript"
        options={[
          { label: 'OpenAI', value: 'openai' },
          { label: 'Anthropic', value: 'anthropic' },
          { label: 'Mastra', value: 'mastra' },
        ]}
        value={provider}
        onValueChange={setProvider}
      />
    );
  },
};
