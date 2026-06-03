import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MessageFactory } from './MessageFactory';
import type { MessageRenderers, MessageRoleRenderers } from './types';

// Boundary cast mirrors how the accumulator stores runtime-only parts.
const asParts = (parts: unknown[]): MastraDBMessage['content']['parts'] => parts as MastraDBMessage['content']['parts'];

const makeMessage = (parts: unknown[], role: MastraDBMessage['role'] = 'assistant'): MastraDBMessage => ({
  id: 'story-1',
  role,
  createdAt: new Date(),
  content: { format: 2, parts: asParts(parts) },
});

const card: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '8px 12px',
  marginBottom: 8,
  fontFamily: 'system-ui, sans-serif',
};

const renderers: MessageRenderers = {
  Text: part => <div style={{ ...card, background: '#f8fafc' }}>{part.text}</div>,
  Reasoning: part => <div style={{ ...card, fontStyle: 'italic', color: '#64748b' }}>💭 {part.reasoning}</div>,
  ToolInvocation: part => (
    <div style={{ ...card, background: '#eff6ff' }}>
      🔧 tool-invocation: <strong>{part.toolInvocation.toolName}</strong> ({part.toolInvocation.state})
    </div>
  ),
  DynamicTool: part => (
    <div style={{ ...card, background: '#ecfdf5' }}>
      ⚡ dynamic-tool: <strong>{part.toolName}</strong> ({part.state})
    </div>
  ),
  Data: part => (
    <div style={{ ...card, background: '#fff7ed' }}>
      📦 {part.type}: <code>{JSON.stringify(part.data)}</code>
    </div>
  ),
};

const Component = () => (
  <div style={{ maxWidth: '60ch', margin: '0 auto' }}>
    <MessageFactory
      message={makeMessage([
        { type: 'reasoning', reasoning: 'Looking up the weather before answering.' },
        { type: 'text', text: 'The weather in Paris is sunny today.' },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'c-1', toolName: 'getWeather', args: {}, result: {} },
        },
        { type: 'dynamic-tool', toolName: 'searchDocs', toolCallId: 'c-2', state: 'output-available' },
        { type: 'data-signal', data: { kind: 'cursor' } },
      ])}
      {...renderers}
    />
  </div>
);

const meta = {
  title: 'Components/MessageFactory',
  component: Component,
  parameters: {},
  tags: ['autodocs'],
  argTypes: {},
  args: {},
} satisfies Meta<typeof Component>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const SignalComponent = () => {
  const roles: MessageRoleRenderers = {
    Signal: ({ children }) => (
      <aside style={{ borderLeft: '3px solid #a855f7', paddingLeft: 12 }}>
        <div style={{ fontSize: 12, color: '#a855f7', marginBottom: 4 }}>SIGNAL</div>
        {children}
      </aside>
    ),
  };

  return (
    <div style={{ maxWidth: '60ch', margin: '0 auto' }}>
      <MessageFactory
        message={makeMessage([{ type: 'text', text: 'A signal-role message wrapped by roles.Signal.' }], 'signal')}
        roles={roles}
        {...renderers}
      />
    </div>
  );
};

export const SignalRole: Story = {
  render: () => <SignalComponent />,
};
