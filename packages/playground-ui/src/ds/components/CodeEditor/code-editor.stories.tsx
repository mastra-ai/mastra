import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeEditor } from './code-editor';
import { TooltipProvider } from '../Tooltip';

const meta: Meta<typeof CodeEditor> = {
  title: 'Composite/CodeEditor',
  component: CodeEditor,
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
  argTypes: {
    showCopyButton: {
      control: { type: 'boolean' },
    },
    language: {
      control: { type: 'select' },
      options: ['json', 'markdown'],
    },
    highlightVariables: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CodeEditor>;

export const Default: Story = {
  args: {
    data: {
      name: 'my-agent',
      model: 'gpt-4',
      temperature: 0.7,
    },
    className: 'w-[400px]',
  },
};

export const WithValue: Story = {
  args: {
    value: `{
  "name": "workflow-1",
  "steps": [
    { "id": "step-1", "type": "trigger" },
    { "id": "step-2", "type": "action" }
  ]
}`,
    className: 'w-[400px]',
  },
};

export const ComplexData: Story = {
  args: {
    data: {
      agent: {
        name: 'Customer Support',
        model: 'gpt-4-turbo',
        settings: {
          temperature: 0.7,
          maxTokens: 4096,
          topP: 1,
        },
      },
      tools: ['search', 'calculator', 'web-browser'],
      memory: {
        enabled: true,
        type: 'conversation',
      },
    },
    className: 'w-[500px]',
  },
};

export const ArrayData: Story = {
  args: {
    data: [
      { id: 1, name: 'Agent 1', status: 'active' },
      { id: 2, name: 'Agent 2', status: 'inactive' },
      { id: 3, name: 'Agent 3', status: 'active' },
    ],
    className: 'w-[400px]',
  },
};

export const WithoutCopyButton: Story = {
  args: {
    data: { message: 'Hello, World!' },
    showCopyButton: false,
    className: 'w-[300px]',
  },
};

export const LargeContent: Story = {
  args: {
    data: {
      workflow: {
        id: 'wf-123',
        name: 'Data Processing Pipeline',
        description: 'A workflow that processes and transforms data',
        steps: [
          { id: 's1', type: 'trigger', config: { event: 'webhook' } },
          { id: 's2', type: 'transform', config: { operation: 'map' } },
          { id: 's3', type: 'validate', config: { schema: 'output' } },
          { id: 's4', type: 'output', config: { destination: 'database' } },
        ],
        metadata: {
          created: '2026-01-14',
          updated: '2026-01-14',
          version: '1.0.0',
        },
      },
    },
    className: 'w-[600px] max-h-[400px] overflow-auto',
  },
};

export const MarkdownWithVariables: Story = {
  args: {
    value: `# Agent Instructions

You are a helpful assistant for {{companyName}}.

## Context
- User: {{userName}}
- Role: {{userRole}}

## Guidelines

1. Always greet the user by their name: {{userName}}
2. Use the company context: {{companyContext}}
3. Respond in the user's preferred language: {{preferredLanguage}}

## Example Response

Hello {{userName}}, welcome to {{companyName}}! How can I help you today?`,
    language: 'markdown',
    highlightVariables: true,
    className: 'w-[600px]',
  },
};

export const MarkdownWithoutVariables: Story = {
  args: {
    value: `# Simple Markdown

This is a markdown editor without variable highlighting.

## Features

- Syntax highlighting for markdown
- Code blocks support
- Line wrapping enabled

\`\`\`javascript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

Regular text continues here.`,
    language: 'markdown',
    highlightVariables: false,
    className: 'w-[600px]',
  },
};
