// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { NetworkChoiceMetadataDialogTrigger } from '../network-choice-metadata-dialog';

afterEach(() => cleanup());

describe('NetworkChoiceMetadataDialogTrigger', () => {
  it('opens a dialog showing the selection reason when the trigger is clicked', () => {
    render(<NetworkChoiceMetadataDialogTrigger selectionReason="Best suited for weather questions" />);

    expect(screen.queryByText('Best suited for weather questions')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /show selection reason/i }));

    expect(screen.getByText('Agent Network Metadata')).toBeTruthy();
    expect(screen.getByText('Best suited for weather questions')).toBeTruthy();
  });

  it('omits the input section when no input is provided', () => {
    render(<NetworkChoiceMetadataDialogTrigger selectionReason="reason" />);
    fireEvent.click(screen.getByRole('button', { name: /show selection reason/i }));

    expect(screen.queryByText('Input')).toBeNull();
  });

  it('renders an object input as code', () => {
    render(<NetworkChoiceMetadataDialogTrigger selectionReason="reason" input={{ city: 'Paris' }} />);
    fireEvent.click(screen.getByRole('button', { name: /show selection reason/i }));

    expect(screen.getByText('Input')).toBeTruthy();
    expect(document.body.textContent).toContain('Paris');
  });

  it('falls back to raw text when a string input is not valid JSON', () => {
    render(<NetworkChoiceMetadataDialogTrigger selectionReason="reason" input="not json" />);
    fireEvent.click(screen.getByRole('button', { name: /show selection reason/i }));

    const pre = screen.getByText('not json');
    expect(pre.tagName).toBe('PRE');
  });
});
