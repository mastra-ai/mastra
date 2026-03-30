'use client';

import type { ComponentType } from 'react';
import { useState } from 'react';
import { AgentResponsesExample } from './agent-responses-example';
import { AgentToolResponsesExample } from './agent-tool-responses-example';
import { ConversationsExample } from './conversations-example';
import { OpenAISDKResponsesExample } from './openai-sdk-responses-example';
import { ProviderBackedResponsesExample } from './provider-backed-responses-example';

type ExampleId = 'agent-memory' | 'agent-tools' | 'conversations' | 'openai-sdk' | 'provider-backed';

const EXAMPLES = [
  { id: 'agent-memory', label: 'Mastra Agent Responses', withConversations: false, Component: AgentResponsesExample },
  { id: 'agent-tools', label: 'Mastra Agent + Tool Responses', withConversations: false, Component: AgentToolResponsesExample },
  { id: 'conversations', label: 'Conversations', withConversations: true, Component: ConversationsExample },
  { id: 'openai-sdk', label: 'Mastra via OpenAI SDK', withConversations: false, Component: OpenAISDKResponsesExample },
  { id: 'provider-backed', label: 'Provider-backed Agent Responses', withConversations: false, Component: ProviderBackedResponsesExample },
] as const satisfies readonly {
  id: ExampleId;
  label: string;
  withConversations: boolean;
  Component: ComponentType;
}[];

const EXAMPLE_BY_ID = Object.fromEntries(EXAMPLES.map(example => [example.id, example])) as Record<ExampleId, (typeof EXAMPLES)[number]>;

export function ResponsesApiDemo() {
  const [activeExampleId, setActiveExampleId] = useState<ExampleId>('agent-memory');
  const activeExample = EXAMPLE_BY_ID[activeExampleId];
  let ActiveComponent: ComponentType;

  switch (activeExampleId) {
    case 'agent-memory':
      ActiveComponent = AgentResponsesExample;
      break;
    case 'agent-tools':
      ActiveComponent = AgentToolResponsesExample;
      break;
    case 'conversations':
      ActiveComponent = ConversationsExample;
      break;
    case 'openai-sdk':
      ActiveComponent = OpenAISDKResponsesExample;
      break;
    case 'provider-backed':
      ActiveComponent = ProviderBackedResponsesExample;
      break;
  }

  return (
    <main className={`demo-shell demo-shell--with-sidebar${activeExample.withConversations ? ' demo-shell--with-conversations' : ''}`}>
      <aside className="demo-sidebar">
        <div className="demo-sidebar__header">
          <span className="demo-sidebar__eyebrow">Modes</span>
        </div>

        <nav className="demo-sidebar__nav" aria-label="Example modes">
          {EXAMPLES.map(example => (
            <button
              key={example.id}
              className={`demo-sidebar-item${example.id === activeExampleId ? ' is-active' : ''}`}
              onClick={() => setActiveExampleId(example.id)}
              type="button"
            >
              <span className="demo-sidebar-item__title">{example.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <ActiveComponent />
    </main>
  );
}
