import type { TextPart } from '@mastra/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { MessageMetadata } from '../../message-metadata';
import { AssistantTextPartRenderer } from '../assistant-text-part-renderer';

describe('AssistantTextPartRenderer', () => {
  it('renders markdown text', () => {
    const part = { type: 'text', text: 'hello **world**' } as TextPart;

    render(<AssistantTextPartRenderer part={part} />);

    expect(screen.getByText('world')).not.toBeNull();
  });

  it('renders the empty string safely when text is missing', () => {
    const part = { type: 'text' } as TextPart;

    const { container } = render(<AssistantTextPartRenderer part={part} />);

    expect(container).not.toBeNull();
  });

  it('routes error-status metadata into an error notice', () => {
    const part = { type: 'text', text: 'boom' } as TextPart;
    const metadata: MessageMetadata = { status: 'error' };

    render(<AssistantTextPartRenderer part={part} metadata={metadata} />);

    expect(screen.getByText('boom')).not.toBeNull();
    expect(screen.getByText('Error')).not.toBeNull();
  });

  it('renders a collapsible completion-check notice from completionResult metadata', () => {
    const part = { type: 'text', text: 'all good' } as TextPart;
    const metadata: MessageMetadata = { completionResult: { passed: true } };

    render(<AssistantTextPartRenderer part={part} metadata={metadata} />);

    expect(screen.getByText('Complete')).not.toBeNull();
    expect(screen.getByText('all good')).not.toBeNull();
  });
});
