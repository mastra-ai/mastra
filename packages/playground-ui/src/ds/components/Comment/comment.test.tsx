// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  cleanup();
});

const Thread = ({ variant }: { variant?: CommentVariant }) => (
  <Comment variant={variant}>
    <CommentList aria-label="Comments">
      <CommentItem>
        <CommentItemHeader>
          <CommentItemAuthor>Marvin Frachet</CommentItemAuthor>
          <CommentItemTimestamp dateTime="2026-08-26T09:00:00Z">Just now</CommentItemTimestamp>
          <CommentItemActions aria-label="Comment actions">
            <button type="button">Resolve</button>
          </CommentItemActions>
        </CommentItemHeader>
        <CommentItemBody>Hello world</CommentItemBody>
      </CommentItem>
    </CommentList>
  </Comment>
);

describe('Comment', () => {
  it('renders the thread with stable slots', () => {
    render(<Thread />);

    const list = screen.getByRole('list', { name: 'Comments' });
    expect(list.getAttribute('data-slot')).toBe('comment-list');
    expect(list.closest('[data-slot="comment"]')?.getAttribute('data-variant')).toBe('default');
    expect(screen.getByRole('listitem').getAttribute('data-slot')).toBe('comment-item');
    expect(screen.getByText('Marvin Frachet').getAttribute('data-slot')).toBe('comment-item-author');
    expect(screen.getByText('Just now').getAttribute('data-slot')).toBe('comment-item-timestamp');
    expect(screen.getByText('Hello world').getAttribute('data-slot')).toBe('comment-item-body');
  });

  it('renders item actions in the default variant', () => {
    render(<Thread />);

    expect(screen.getByRole('button', { name: 'Resolve' })).toBeTruthy();
  });

  it('drops item actions in the embed variant', () => {
    render(<Thread variant="embed" />);

    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull();
    expect(document.querySelector('[data-slot="comment"]')?.getAttribute('data-variant')).toBe('embed');
  });

  it('throws when a compound is rendered outside Comment', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<CommentList />)).toThrow('Comment compounds must be rendered within Comment');

    consoleError.mockRestore();
  });
});

describe('CommentComposer', () => {
  const ControlledComposer = ({ onSend }: { onSend: (value: string) => void }) => {
    const [value, setValue] = useState('');

    return (
      <Comment>
        <CommentComposer
          aria-label="Add a comment"
          onSubmit={event => {
            event.preventDefault();
            onSend(value);
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
            <CommentComposerSend />
          </CommentComposerInput>
        </CommentComposer>
      </Comment>
    );
  };

  it('submits the typed comment through the send button', () => {
    const onSend = vi.fn();
    render(<ControlledComposer onSend={onSend} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Comment' }), { target: { value: 'Ca va ?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send comment' }));

    expect(onSend).toHaveBeenCalledWith('Ca va ?');
  });

  it('exposes the composer as a form with a submit button', () => {
    render(<ControlledComposer onSend={vi.fn()} />);

    const form = screen.getByRole('form', { name: 'Add a comment' });
    expect(form.getAttribute('data-slot')).toBe('comment-composer');
    expect(screen.getByRole('button', { name: 'Send comment' }).getAttribute('type')).toBe('submit');
  });
});
