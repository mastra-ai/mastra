import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, MoreHorizontal, SmilePlus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../Button';
import {
  Comment,
  CommentItem,
  CommentItemActions,
  CommentItemAuthor,
  CommentItemBody,
  CommentItemHeader,
  CommentItemTimestamp,
  CommentList,
} from './comment';
import { CommentComposer, CommentComposerInput, CommentComposerSend } from './comment-composer';
import type { CommentVariant } from './comment-context';

const meta: Meta<typeof Comment> = {
  title: 'Elements/Comment',
  component: Comment,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof Comment>;

const threadItems = [
  {
    id: '1',
    author: 'Marvin Frachet',
    dateTime: '2026-08-26T09:00:00Z',
    time: 'Just now',
    body: 'Hello world, how are you?',
  },
  {
    id: '2',
    author: 'Marvin Frachet',
    dateTime: '2026-08-26T09:01:00Z',
    time: 'Just now',
    body: 'Doing well, thanks!',
  },
];

const Thread = ({ variant }: { variant: CommentVariant }) => (
  <Comment variant={variant} className="max-w-2xl">
    <CommentList>
      {threadItems.map(item => (
        <CommentItem key={item.id}>
          <CommentItemHeader>
            <CommentItemAuthor>{item.author}</CommentItemAuthor>
            <CommentItemTimestamp dateTime={item.dateTime}>{item.time}</CommentItemTimestamp>
            <CommentItemActions>
              <Button size="icon-sm" variant="ghost" aria-label="React">
                <SmilePlus />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Resolve">
                <Check />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </CommentItemActions>
          </CommentItemHeader>
          <CommentItemBody>{item.body}</CommentItemBody>
        </CommentItem>
      ))}
    </CommentList>
    <CommentComposer aria-label="Add a comment">
      <CommentComposerInput aria-label="Comment" placeholder={variant === 'embed' ? 'Reply...' : 'Add a comment...'}>
        <CommentComposerSend />
      </CommentComposerInput>
    </CommentComposer>
  </Comment>
);

export const Default: Story = {
  render: () => <Thread variant="default" />,
};

/** Card surface, compact composer, no per-item actions. */
export const Embed: Story = {
  render: () => <Thread variant="embed" />,
};

export const ComposerOnly: Story = {
  render: () => (
    <Comment className="max-w-2xl">
      <CommentComposer aria-label="Add a comment">
        <CommentComposerInput aria-label="Comment" placeholder="Add a comment...">
          <CommentComposerSend disabled />
        </CommentComposerInput>
      </CommentComposer>
    </Comment>
  ),
};

const InteractiveThread = () => {
  const [items, setItems] = useState([{ id: '1', body: 'Hello world, how are you?' }]);
  const [value, setValue] = useState('');

  return (
    <Comment className="max-w-2xl">
      <CommentList>
        {items.map(item => (
          <CommentItem key={item.id}>
            <CommentItemHeader>
              <CommentItemAuthor>Marvin Frachet</CommentItemAuthor>
              <CommentItemTimestamp dateTime="2026-08-26T09:00:00Z">Just now</CommentItemTimestamp>
            </CommentItemHeader>
            <CommentItemBody>{item.body}</CommentItemBody>
          </CommentItem>
        ))}
      </CommentList>
      <CommentComposer
        aria-label="Add a comment"
        onSubmit={event => {
          event.preventDefault();
          if (!value.trim()) return;
          setItems(current => [...current, { id: String(current.length + 1), body: value }]);
          setValue('');
        }}
      >
        <CommentComposerInput
          aria-label="Comment"
          placeholder="Add a comment..."
          value={value}
          onChange={event => {
            setValue(event.target.value);
          }}
        >
          <CommentComposerSend disabled={!value.trim()} />
        </CommentComposerInput>
      </CommentComposer>
    </Comment>
  );
};

export const Interactive: Story = {
  render: () => <InteractiveThread />,
};
