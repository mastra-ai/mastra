import type { Meta, StoryObj } from '@storybook/react-vite';

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
import type { CommentVariant } from './comment-context';
import { IconChainLink3 } from '@/ds/icons/central/IconChainLink3';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { IconDotGrid1x3Horizontal } from '@/ds/icons/central/IconDotGrid1x3Horizontal';
import { IconEmojiAddReaction } from '@/ds/icons/central/IconEmojiAddReaction';
import { IconOpenQuote1 } from '@/ds/icons/central/IconOpenQuote1';
import { IconPencil } from '@/ds/icons/central/IconPencil';

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
                <IconEmojiAddReaction />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Resolve">
                <IconCheckmark2Medium />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="More actions">
                <IconDotGrid1x3Horizontal />
              </Button>
            </CommentItemActions>
          </CommentItemHeader>
          <CommentItemBody>{item.body}</CommentItemBody>
        </CommentItem>
      ))}
    </CommentList>
  </Comment>
);

export const Default: Story = {
  render: () => <SimpleThread variant="default" />,
};

/** Card surface, no per-item actions. */
export const Embed: Story = {
  render: () => <SimpleThread variant="embed" />,
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
            <CommentItemBody>{row.body}</CommentItemBody>
          </CommentItemContent>
          <CommentItemActions>
            <Button size="icon-sm" variant="ghost" aria-label="Quote reply">
              <IconOpenQuote1 />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Copy link">
              <IconChainLink3 />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Edit comment">
              <IconPencil />
            </Button>
          </CommentItemActions>
        </CommentItem>
      ))}
    </Comment>
  ),
};
