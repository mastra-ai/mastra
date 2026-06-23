import type { ReasoningPart } from '@mastra/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReasoningPartRenderer } from '../reasoning-part-renderer';

describe('ReasoningPartRenderer', () => {
  it('renders the reasoning body from part.reasoning', () => {
    const part: ReasoningPart = { type: 'reasoning', reasoning: 'thinking via reasoning' };

    render(<ReasoningPartRenderer part={part} />);

    expect(screen.getByText('thinking via reasoning')).not.toBeNull();
  });

  it('prefers a part.text field when present', () => {
    // Some persisted/streamed reasoning parts carry `text` rather than
    // `reasoning`; the renderer reads `text` first. `ReasoningPart` only types
    // `reasoning`, so attach `text` via an intersection for this fixture.
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
    // It is the streaming line, not the collapsible panel.
    expect(container.querySelector('pre')).toBeNull();
  });

  it('renders the collapsible panel once streaming reasoning has text', () => {
    const part: ReasoningPart & { state: 'streaming' } = {
      type: 'reasoning',
      reasoning: 'partial thought',
      state: 'streaming',
    };

    const { container } = render(<ReasoningPartRenderer part={part} />);

    expect(container.textContent).toContain('partial thought');
    expect(container.querySelector('pre')).not.toBeNull();
    expect(container.textContent).not.toContain('Reasoning...');
  });

  it('surfaces a label for redacted reasoning instead of an empty box', () => {
    const part: ReasoningPart & { redacted: boolean } = { type: 'reasoning', reasoning: '', redacted: true };

    render(<ReasoningPartRenderer part={part} />);

    expect(screen.getByText('Reasoning was redacted by the provider.')).not.toBeNull();
  });
});
