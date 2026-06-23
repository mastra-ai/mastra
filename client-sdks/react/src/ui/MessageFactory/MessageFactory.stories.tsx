import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { MastraDBMessageMetadata } from '../../lib/mastra-db';
import { MessageFactory } from './MessageFactory';
import type { MessageFactoryPart, MessageRenderers, MessageRoleRenderers, MessageStatusRenderers } from './types';

// Single runtime→persisted boundary, mirroring MessageFactory's own
// `message.content.parts as RuntimePart[]` cast. The persisted
// `MastraMessageContentV2.parts` type excludes runtime-only members
// (`dynamic-tool` / `tool-${string}`), so widening the fully-typed
// `MessageFactoryPart[]` here is the one unavoidable cast — confined,
// named, and with strongly-typed inputs.
const asParts = (parts: MessageFactoryPart[]): MastraDBMessage['content']['parts'] =>
  parts as MastraDBMessage['content']['parts'];

const makeMessage = (parts: MessageFactoryPart[], role: MastraDBMessage['role'] = 'assistant'): MastraDBMessage => ({
  id: 'story-1',
  role,
  createdAt: new Date(),
  content: { format: 2, parts: asParts(parts) },
});

const makeMessageWithMetadata = (
  parts: MessageFactoryPart[],
  metadata: MastraDBMessageMetadata,
  role: MastraDBMessage['role'] = 'assistant',
): MastraDBMessage => ({
  id: 'story-1',
  role,
  createdAt: new Date(),
  content: { format: 2, parts: asParts(parts), metadata },
});

const card: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '8px 12px',
  marginBottom: 8,
  fontFamily: 'system-ui, sans-serif',
};

// Implements every renderer key MessageFactory can dispatch, so the stories
// exercise the full part-rendering surface.
const renderers: MessageRenderers = {
  Text: part => <div style={{ ...card, background: '#f8fafc' }}>{part.text}</div>,
  Reasoning: part => <div style={{ ...card, fontStyle: 'italic', color: '#64748b' }}>💭 {part.reasoning}</div>,
  File: part => (
    <div style={{ ...card, background: '#f1f5f9' }}>
      📎 file: <code>{part.mimeType}</code>
    </div>
  ),
  StepStart: () => <hr style={{ border: 0, borderTop: '1px dashed #cbd5e1', margin: '8px 0' }} />,
  ToolInvocation: part => (
    <div style={{ ...card, background: '#eff6ff' }}>
      🔧 tool-invocation: <strong>{part.toolInvocation.toolName}</strong> ({part.toolInvocation.state})
    </div>
  ),
  SourceUrl: part => (
    <div style={{ ...card, background: '#f5f3ff' }}>
      🔗 source-url:{' '}
      <a href={part.url} target="_blank" rel="noreferrer">
        {part.title ?? part.url}
      </a>
    </div>
  ),
  SourceDocument: part => (
    <div style={{ ...card, background: '#f5f3ff' }}>
      📄 source-document: <strong>{part.title ?? part.sourceId}</strong> ({part.mediaType})
    </div>
  ),
  Data: part => (
    <div style={{ ...card, background: '#fff7ed' }}>
      📦 {part.type}: <code>{JSON.stringify(part.data)}</code>
    </div>
  ),
  DynamicTool: part => (
    <div style={{ ...card, background: '#ecfdf5' }}>
      ⚡ {part.type}: <strong>{part.toolName}</strong> ({part.state})
    </div>
  ),
};

// Every part shape MessageFactory dispatches, in render order. All literals are
// type-checked against `MessageFactoryPart` (no per-part casts).
const allParts: MessageFactoryPart[] = [
  { type: 'reasoning', reasoning: 'Looking up the weather before answering.' },
  { type: 'text', text: 'The weather in Paris is sunny today.' },
  { type: 'file', mimeType: 'image/png', data: 'AAAA' },
  { type: 'file', mimeType: 'application/pdf', data: 'JVBERi0=' },
  { type: 'step-start' },
  {
    type: 'tool-invocation',
    toolInvocation: { state: 'result', toolCallId: 'c-1', toolName: 'getWeather', args: {}, result: {} },
  },
  // Legacy persisted nested `type: 'source'` shape — normalized to SourceUrl.
  { type: 'source', source: { sourceType: 'url', id: 's-1', url: 'https://nested.example', title: 'Nested source' } },
  // Flat runtime `type: 'source-url'` shape pushed by the accumulator.
  { type: 'source-url', sourceId: 's-2', url: 'https://flat.example', title: 'Flat source' },
  { type: 'source-document', sourceId: 's-3', mediaType: 'text/plain', title: 'A document' },
  { type: 'data-signal', data: { kind: 'cursor' } },
  { type: 'data-om-observation', data: { tokens: 128 } },
  { type: 'dynamic-tool', toolName: 'searchDocs', toolCallId: 'c-2', state: 'output-available', input: {}, output: {} },
  { type: 'tool-customStream', toolName: 'customStream', toolCallId: 'c-3', state: 'input-streaming', input: {} },
];

const Component = () => (
  <div style={{ maxWidth: '60ch', margin: '0 auto' }}>
    <MessageFactory message={makeMessage(allParts)} {...renderers} />
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

// Renders one assistant message containing every dispatchable part type.
export const AllParts: Story = {};

const RolesComponent = () => {
  const roles: MessageRoleRenderers = {
    User: ({ children }) => (
      <div style={{ borderLeft: '3px solid #3b82f6', paddingLeft: 12 }}>
        <div style={{ fontSize: 12, color: '#3b82f6', marginBottom: 4 }}>USER</div>
        {children}
      </div>
    ),
    Assistant: ({ children }) => (
      <div style={{ borderLeft: '3px solid #10b981', paddingLeft: 12 }}>
        <div style={{ fontSize: 12, color: '#10b981', marginBottom: 4 }}>ASSISTANT</div>
        {children}
      </div>
    ),
    System: ({ children }) => (
      <div style={{ borderLeft: '3px solid #64748b', paddingLeft: 12 }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>SYSTEM</div>
        {children}
      </div>
    ),
    Signal: ({ children }) => (
      <aside style={{ borderLeft: '3px solid #a855f7', paddingLeft: 12 }}>
        <div style={{ fontSize: 12, color: '#a855f7', marginBottom: 4 }}>SIGNAL</div>
        {children}
      </aside>
    ),
  };

  return (
    <div style={{ maxWidth: '60ch', margin: '0 auto', display: 'grid', gap: 16 }}>
      <MessageFactory
        message={makeMessage([{ type: 'text', text: 'A user-role message.' }], 'user')}
        roles={roles}
        {...renderers}
      />
      <MessageFactory
        message={makeMessage([{ type: 'text', text: 'An assistant-role message.' }], 'assistant')}
        roles={roles}
        {...renderers}
      />
      <MessageFactory
        message={makeMessage([{ type: 'text', text: 'A system-role message.' }], 'system')}
        roles={roles}
        {...renderers}
      />
      <MessageFactory
        message={makeMessage([{ type: 'text', text: 'A signal-role message.' }], 'signal')}
        roles={roles}
        {...renderers}
      />
    </div>
  );
};

// One MessageFactory per role wrapper (User / Assistant / System / Signal).
export const Roles: Story = {
  render: () => <RolesComponent />,
};

const status: MessageStatusRenderers = {
  Tripwire: props => (
    <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>
      🚧 Tripwire{props.tripwire?.processorId ? ` (${props.tripwire.processorId})` : ''}:{' '}
      {props.tripwire?.reason ?? props.text}
    </div>
  ),
  Warning: props => (
    <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a', color: '#b45309' }}>⚠️ {props.text}</div>
  ),
  Error: props => (
    <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>❌ {props.text}</div>
  ),
  Task: props => (
    <div style={{ ...card, background: props.passed ? '#f0fdf4' : '#fef2f2' }}>
      {props.passed ? '✅' : '🔁'} task {props.passed ? 'passed' : 'not complete'}
      {props.suppressFeedback ? ' (feedback suppressed)' : ''}
    </div>
  ),
};

// Replacement status slots (Tripwire / Warning / Error) render INSTEAD of the
// parts; the adjacent Task slot renders ALONGSIDE the parts. This story shows
// all four slots — plus a feedback-suppressed Task verdict to prove the factory
// forwards `suppressFeedback` unfiltered — so the slot surface is inspectable.
const StatusSlotsComponent = () => (
  <div style={{ maxWidth: '60ch', margin: '0 auto', display: 'grid', gap: 16 }}>
    <MessageFactory
      message={makeMessageWithMetadata([{ type: 'text', text: 'Blocked input.' }], {
        status: 'tripwire',
        tripwire: { reason: 'PII detected in prompt', processorId: 'pii-guard' },
      })}
      status={status}
      {...renderers}
    />
    <MessageFactory
      message={makeMessageWithMetadata([{ type: 'text', text: 'Approaching the token budget.' }], {
        status: 'warning',
      })}
      status={status}
      {...renderers}
    />
    <MessageFactory
      message={makeMessageWithMetadata([{ type: 'text', text: 'The model run failed.' }], { status: 'error' })}
      status={status}
      {...renderers}
    />
    <MessageFactory
      message={makeMessageWithMetadata([{ type: 'text', text: 'Drafted the summary.' }], {
        completionResult: { passed: true },
      })}
      status={status}
      {...renderers}
    />
    <MessageFactory
      message={makeMessageWithMetadata([{ type: 'text', text: 'Retrying the task silently.' }], {
        completionResult: { passed: false, suppressFeedback: true },
      })}
      status={status}
      {...renderers}
    />
  </div>
);

export const StatusSlots: Story = {
  render: () => <StatusSlotsComponent />,
};

const FallbackComponent = () => (
  <div style={{ maxWidth: '60ch', margin: '0 auto' }}>
    <MessageFactory
      message={makeMessage([
        { type: 'text', text: 'A normal part renders through its renderer.' },
        // A runtime-only part with no matching renderer: caught by `fallback`.
        { type: 'tool-mysteryStream', toolName: 'mystery', toolCallId: 'c-9', state: 'output-available' },
      ])}
      Text={renderers.Text}
      fallback={part => <div style={{ ...card, background: '#fef9c3' }}>❓ unhandled part: {part.type}</div>}
    />
  </div>
);

// Proves the fallback path renders for parts with no matching renderer.
export const Fallback: Story = {
  render: () => <FallbackComponent />,
};
