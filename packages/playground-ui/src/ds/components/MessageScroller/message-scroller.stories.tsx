import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from '../Button';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from './message-scroller';

type DemoMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const initialMessages: DemoMessage[] = [
  { id: 'user-1', role: 'user', text: 'Summarize the latest production traces.' },
  { id: 'assistant-1', role: 'assistant', text: 'I found 126 traces. Three failed during tool execution.' },
  { id: 'user-2', role: 'user', text: 'Which tool caused those failures?' },
  {
    id: 'assistant-2',
    role: 'assistant',
    text: 'All three came from web-search after the provider returned rate limits.',
  },
  { id: 'user-3', role: 'user', text: 'Show me the affected run IDs.' },
  { id: 'assistant-3', role: 'assistant', text: 'The affected runs are run_8f3a, run_9c12, and run_b772.' },
];

const meta: Meta<typeof MessageScroller> = {
  title: 'Layout/MessageScroller',
  component: MessageScroller,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof MessageScroller>;

function MessageScrollerDemo({ autoScroll = false }: { autoScroll?: boolean }) {
  const [messages, setMessages] = useState(initialMessages);

  const addTurn = () => {
    const turn = messages.filter(message => message.role === 'user').length + 1;
    setMessages(current => [
      ...current,
      { id: `user-${turn}`, role: 'user', text: `Follow-up question ${turn}` },
      { id: `assistant-${turn}`, role: 'assistant', text: 'A new answer arrived and extended the conversation.' },
    ]);
  };

  const prependHistory = () => {
    setMessages(current => [
      {
        id: `user-older-${current.length}`,
        role: 'user',
        text: 'An older question loaded above the current reading position.',
      },
      { id: `assistant-older-${current.length}`, role: 'assistant', text: 'Its earlier answer stays paired with it.' },
      ...current,
    ]);
  };

  return (
    <div className="grid w-[min(34rem,calc(100vw-3rem))] gap-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={addTurn}>
          Add turn
        </Button>
        <Button size="sm" variant="ghost" onClick={prependHistory}>
          Load older history
        </Button>
      </div>
      <MessageScrollerProvider autoScroll={autoScroll} defaultScrollPosition="end" preserveScrollOnPrepend>
        <MessageScroller className="border-border1 bg-surface2 h-96 rounded-xl border">
          <MessageScrollerViewport aria-label="Conversation messages">
            <MessageScrollerContent className="gap-4 p-4">
              {messages.map(message => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === 'user'}
                  className={message.role === 'user' ? 'bg-surface4 ml-12 rounded-xl p-3' : 'mr-12 p-3'}
                >
                  <p className="text-ui-sm text-neutral5">{message.text}</p>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  );
}

export const Conversation: Story = {
  render: () => <MessageScrollerDemo />,
};

export const AutoFollow: Story = {
  render: () => <MessageScrollerDemo autoScroll />,
};
