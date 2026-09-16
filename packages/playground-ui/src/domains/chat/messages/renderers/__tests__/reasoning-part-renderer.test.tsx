// @vitest-environment jsdom
import type { ReasoningPart } from '@mastra/react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ReasoningPartRenderer } from '../reasoning-part-renderer';

afterEach(cleanup);

describe('ReasoningPartRenderer', () => {
  it('renders the reasoning body from part.reasoning', () => {
    const part: ReasoningPart = { type: 'reasoning', reasoning: 'thinking via reasoning' };

    render(<ReasoningPartRenderer part={part} />);

    expect(screen.getByText('thinking via reasoning')).not.toBeNull();
  });

  it('prefers a part.text field when present', () => {
    const part: ReasoningPart & { text: string } = {
      type: 'reasoning',
      reasoning: 'unused fallback',
      text: 'thinking via text',
    };

    render(<ReasoningPartRenderer part={part} />);

    expect(screen.getByText('thinking via text')).not.toBeNull();
  });

  it('renders nothing when reasoning is empty and not streaming so there is no dangling toggle', () => {
    const part: ReasoningPart & { state: 'done' } = { type: 'reasoning', reasoning: '', state: 'done' };

    const { container } = render(<ReasoningPartRenderer part={part} />);

    expect(container.querySelector('pre')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('shows a streaming "Reasoning..." shimmer line while reasoning is streaming with no text yet', () => {
    const part: ReasoningPart & { state: 'streaming' } = { type: 'reasoning', reasoning: '', state: 'streaming' };

    const { container } = render(<ReasoningPartRenderer part={part} />);

    expect(container.textContent).toContain('Reasoning...');
    expect(screen.queryByRole('button', { name: /reasoning/ })).toBeNull();
  });

  it('renders the collapsible panel once streaming reasoning has text', () => {
    const part: ReasoningPart & { state: 'streaming' } = {
      type: 'reasoning',
      reasoning: 'partial thought',
      state: 'streaming',
    };

    const { container } = render(<ReasoningPartRenderer part={part} />);

    expect(container.textContent).toContain('partial thought');
    expect(screen.getByRole('button', { name: 'Hide reasoning' })).toBeTruthy();
    expect(container.textContent).not.toContain('Reasoning...');
  });

  it('surfaces a label for redacted reasoning instead of an empty box', () => {
    const part: ReasoningPart & { redacted: boolean } = { type: 'reasoning', reasoning: '', redacted: true };

    render(<ReasoningPartRenderer part={part} />);

    expect(screen.getByText('Reasoning was redacted by the provider.')).not.toBeNull();
  });

  it('replaces the waiting indicator with text and keeps it after streaming finishes', () => {
    const part: ReasoningPart = { type: 'reasoning', reasoning: '', state: 'streaming' };
    const { rerender } = render(<ReasoningPartRenderer part={part} />);
    expect(screen.getByText('Reasoning...')).toBeTruthy();

    rerender(<ReasoningPartRenderer part={{ ...part, reasoning: 'A partial thought' }} />);
    expect(screen.queryByText('Reasoning...')).toBeNull();
    expect(screen.getByText('A partial thought')).toBeTruthy();

    rerender(<ReasoningPartRenderer part={{ ...part, reasoning: 'A complete thought', state: 'done' }} />);
    expect(screen.getByText('A complete thought')).toBeTruthy();
  });
});
