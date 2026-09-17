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
import { CommentEditor } from './comment-editor';
import { CommentQuote } from './comment-quote';

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

describe('Comment thread variant', () => {
  const ThreadRow = () => (
    <Comment variant="thread">
      <CommentItem>
        <CommentItemHeader>
          <CommentItemAuthor>Marvin Frachet</CommentItemAuthor>
          <CommentItemTimestamp dateTime="2026-09-04T09:00:00Z">2h</CommentItemTimestamp>
        </CommentItemHeader>
        <CommentItemBody>Hello world</CommentItemBody>
        <CommentItemActions>
          <button type="button">Quote reply</button>
        </CommentItemActions>
      </CommentItem>
    </Comment>
  );

  it('renders the row as a stream entry rather than a list item', () => {
    render(<ThreadRow />);

    expect(screen.queryByRole('listitem')).toBeNull();
    expect(document.querySelector('[data-slot="comment-item"]')?.tagName).toBe('DIV');
  });

  it('keeps per-row actions, unlike the embed variant', () => {
    render(<ThreadRow />);

    expect(screen.getByRole('button', { name: 'Quote reply' })).toBeTruthy();
  });

  it('renders a body that can hold rendered markdown blocks', () => {
    render(<ThreadRow />);

    expect(screen.getByText('Hello world').tagName).toBe('DIV');
  });
});

describe('CommentQuote', () => {
  it('attributes the passage to its author', () => {
    render(<CommentQuote authorName="Marvin Frachet" quote="should it move to Review?" />);

    expect(screen.getByText('Marvin Frachet')).toBeTruthy();
    expect(screen.getByText('should it move to Review?')).toBeTruthy();
  });

  it('offers to drop the quote only while it is a draft', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<CommentQuote quote="a passage" />);
    expect(screen.queryByRole('button', { name: 'Remove quote' })).toBeNull();

    rerender(<CommentQuote quote="a passage" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove quote' }));

    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('CommentEditor', () => {
  const type = (value: string) =>
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit comment' }), {
      target: { value },
    });
  const saveButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Save' });

  it('hands the trimmed draft to the caller and leaves closing to it', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<CommentEditor initialBody="before" onSave={onSave} onClose={onClose} />);

    type('  after  ');
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith('after');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('locks while the caller reports a save in flight', () => {
    const onSave = vi.fn();
    render(<CommentEditor initialBody="before" onSave={onSave} onClose={vi.fn()} isPending />);

    type('after');
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit comment' }), { key: 'Enter' });

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Saving…' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Edit comment' }).readOnly).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('surfaces why the caller says the save failed', () => {
    render(
      <CommentEditor initialBody="before" onSave={vi.fn()} onClose={vi.fn()} error="Comment was edited elsewhere" />,
    );

    expect(screen.getByRole('alert').textContent).toBe('Comment was edited elsewhere');
  });

  it('locks an emptied draft instead of sending it', () => {
    const onSave = vi.fn();
    render(<CommentEditor initialBody="before" onSave={onSave} onClose={vi.fn()} />);

    type('   ');
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit comment' }), { key: 'Enter' });

    expect(saveButton().disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('closes without a save when nothing changed', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<CommentEditor initialBody="before" onSave={onSave} onClose={onClose} />);

    fireEvent.click(saveButton());

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('saves on Enter but keeps Shift+Enter for a new line', () => {
    const onSave = vi.fn();
    render(<CommentEditor initialBody="before" onSave={onSave} onClose={vi.fn()} />);

    const textarea = screen.getByRole('textbox', { name: 'Edit comment' });
    type('after');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('after');
  });
});
