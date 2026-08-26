// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FeedbackComposer } from '../feedback-composer';

afterEach(() => cleanup());

const getInput = () => screen.getByPlaceholderText('Leave feedback...') as HTMLTextAreaElement;
const getSubmit = () => screen.getByRole('button', { name: 'Send feedback' }) as HTMLButtonElement;
const type = (value: string) => fireEvent.change(getInput(), { target: { value } });

describe('FeedbackComposer', () => {
  it('disables the submit button while the input is empty', () => {
    render(<FeedbackComposer onSubmit={vi.fn()} />);

    expect(getSubmit().disabled).toBe(true);
  });

  it('submits the typed text when the button is clicked and clears the input', () => {
    const onSubmit = vi.fn();
    render(<FeedbackComposer onSubmit={onSubmit} />);

    type('this span looks wrong');
    fireEvent.click(getSubmit());

    expect(onSubmit).toHaveBeenCalledWith('this span looks wrong');
    expect(getInput().value).toBe('');
  });

  it('submits on Enter but not on Shift+Enter', () => {
    const onSubmit = vi.fn();
    render(<FeedbackComposer onSubmit={onSubmit} />);

    type('first line');
    fireEvent.keyDown(getInput(), { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(getInput(), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('first line');
  });

  it('ignores whitespace-only input', () => {
    const onSubmit = vi.fn();
    render(<FeedbackComposer onSubmit={onSubmit} />);

    type('   ');

    expect(getSubmit().disabled).toBe(true);
    fireEvent.keyDown(getInput(), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables the submit button while submitting', () => {
    const { rerender } = render(<FeedbackComposer onSubmit={vi.fn()} />);

    type('hello');
    expect(getSubmit().disabled).toBe(false);

    rerender(<FeedbackComposer onSubmit={vi.fn()} isSubmitting />);
    expect(getSubmit().disabled).toBe(true);
  });
});
