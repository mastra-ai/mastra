import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, Link2, MoreHorizontal, Pencil, Quote, SmilePlus } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '../Avatar';
import { Button } from '../Button';
import {
  Comment,
  CommentItem,
  CommentItemActions,
  CommentItemAuthor,
  CommentItemAvatar,
  CommentItemBody,
  CommentItemContent,
  CommentItemHeader,
  CommentItemTimestamp,
  CommentList,
} from './comment';
import { CommentComposer, CommentComposerInput, CommentComposerSend } from './comment-composer';
import type { CommentVariant } from './comment-context';
import { CommentEditor } from './comment-editor';
import { CommentQuote } from './comment-quote';

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

const SimpleThread = ({ variant }: { variant: CommentVariant }) => (
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
  render: () => <SimpleThread variant="default" />,
};

/** Card surface, compact composer, no per-item actions. */
export const Embed: Story = {
  render: () => <SimpleThread variant="embed" />,
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

const threadRows = [
  {
    id: '1',
    author: 'Marvin Frachet',
    dateTime: '2026-09-04T09:00:00Z',
    time: '2h',
    body: 'The board keeps the failed card in place — should it move to Review instead?',
  },
  {
    id: '2',
    author: 'Marvin Frachet',
    dateTime: '2026-09-04T09:02:00Z',
    time: '2h',
    body: 'Same for a card the agent gave up on.',
    continued: true,
  },
  {
    id: '3',
    author: 'Damien Schneider',
    dateTime: '2026-09-04T10:30:00Z',
    time: '31m',
    body: 'Only when a human asked for it. An automatic move would hide the failure.',
    quote: { authorName: 'Marvin Frachet', quote: 'should it move to Review instead?' },
  },
];

/**
 * The dense feed row: avatar gutter, inline header, markdown-sized body, and an
 * actions bar hung over the row's own top edge that a hover reveals.
 */
export const Thread: Story = {
  render: () => (
    <Comment variant="thread" className="max-w-2xl">
      {threadRows.map(row => (
        <CommentItem key={row.id} continued={row.continued} highlighted={row.id === '3'}>
          <CommentItemAvatar>{row.continued ? null : <Avatar name={row.author} size="sm" />}</CommentItemAvatar>
          <CommentItemContent>
            {row.continued ? null : (
              <CommentItemHeader>
                <CommentItemAuthor>{row.author}</CommentItemAuthor>
                <CommentItemTimestamp dateTime={row.dateTime}>{row.time}</CommentItemTimestamp>
              </CommentItemHeader>
            )}
            {row.quote ? <CommentQuote {...row.quote} className="mt-1" /> : null}
            <CommentItemBody>{row.body}</CommentItemBody>
          </CommentItemContent>
          <CommentItemActions>
            <Button size="icon-xs" variant="ghost" aria-label="Quote reply">
              <Quote />
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label="Copy link">
              <Link2 />
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label="Edit comment">
              <Pencil />
            </Button>
          </CommentItemActions>
        </CommentItem>
      ))}
    </Comment>
  ),
};

const EditableRow = () => {
  const [body, setBody] = useState('Only when a human asked for it.');
  const [editing, setEditing] = useState(true);

  return (
    <Comment variant="thread" className="max-w-2xl">
      <CommentItem>
        <CommentItemAvatar>
          <Avatar name="Damien Schneider" size="sm" />
        </CommentItemAvatar>
        <CommentItemContent>
          <CommentItemHeader>
            <CommentItemAuthor>Damien Schneider</CommentItemAuthor>
            <CommentItemTimestamp dateTime="2026-09-04T10:30:00Z">31m</CommentItemTimestamp>
          </CommentItemHeader>
          {editing ? (
            <CommentEditor initialBody={body} onSave={async next => setBody(next)} onClose={() => setEditing(false)} />
          ) : (
            <CommentItemBody>{body}</CommentItemBody>
          )}
        </CommentItemContent>
        <CommentItemActions>
          <Button size="icon-xs" variant="ghost" aria-label="Edit comment" onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
        </CommentItemActions>
      </CommentItem>
    </Comment>
  );
};

/** Editing in place: the draft survives a failed save, and only a landed save closes the box. */
export const Editing: Story = {
  render: () => <EditableRow />,
};
