import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Message,
  MessageActions,
  MessageContent,
  MessageUsageEntry,
  MessageUsageValue,
  MessageUsage,
  MessageUsages,
  MessageList,
} from './Message';
import { IconButton } from '../IconButton';
import { Copy, DollarSign, Mic, Hash } from 'lucide-react';
import { Icon } from '../Icon';
import { useEffect, useState } from 'react';

const Component = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setInterval(() => {
      setCount(prev => prev + 1);
    }, 2000);
  }, []);

  const messages = Array.from({ length: count }, (_, i) => i);

  return (
    <div
      style={{
        maxWidth: '80ch',
        width: '100%',
        height: '80vh',
        margin: '0 auto',
      }}
    >
      <MessageList>
        {messages.map(index =>
          index % 2 === 0 ? (
            <Message position="right" key={index}>
              <MessageContent>Hello world</MessageContent>
            </Message>
          ) : (
            <Message position="left" key={index}>
              <MessageUsages>
                <MessageUsage>
                  <MessageUsageEntry>
                    <Icon>
                      <Hash />
                    </Icon>
                    Tokens:
                  </MessageUsageEntry>
                  <MessageUsageValue>100</MessageUsageValue>
                </MessageUsage>

                <MessageUsage>
                  <MessageUsageEntry>
                    <Icon>
                      <DollarSign />
                    </Icon>
                    Money:
                  </MessageUsageEntry>
                  <MessageUsageValue>10$</MessageUsageValue>
                </MessageUsage>
              </MessageUsages>

              <MessageContent>World?</MessageContent>

              <MessageActions>
                <IconButton tooltip="Voice message">
                  <Mic />
                </IconButton>

                <IconButton tooltip="Copy">
                  <Copy />
                </IconButton>
              </MessageActions>
            </Message>
          ),
        )}
      </MessageList>
    </div>
  );
};

const meta = {
  title: 'Components/Message',
  component: Component,
  parameters: {},
  tags: ['autodocs'],
  argTypes: {},
  args: {},
} satisfies Meta<typeof Component>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const StreamingComponent = () => {
  const [message, setMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    const output = `The weather in Paris is sunny. Some cloud might happen during the day, but overall, it should be a nice day. I would like to suggest you to wear a light jacket and take an umbrella with you. In terms of activities, you can go to the park, take a walk, or visit the museum.`;

    const chunks = output.split(' ');

    let interval = setInterval(() => {
      const nextChunk = chunks.shift();
      if (!nextChunk) {
        clearInterval(interval);
        setIsStreaming(false);
        return;
      }
      setMessage(prev => prev + nextChunk + ' ');
    }, 60);

    setIsStreaming(true);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        maxWidth: '80ch',
        width: '100%',
        height: '80vh',
        margin: '0 auto',
      }}
    >
      <MessageList>
        <Message position="right">
          <MessageContent>Can you tell me about the weather in Paris?</MessageContent>
        </Message>

        <Message position="left">
          <MessageContent isStreaming={isStreaming}>{message}</MessageContent>
        </Message>
      </MessageList>
    </div>
  );
};

export const Streaming: Story = {
  args: {
    streaming: true,
  },
  render: args => <StreamingComponent {...args} />,
};
