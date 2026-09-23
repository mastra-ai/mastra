// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorStatusRenderer, TripwireStatusRenderer, WarningStatusRenderer } from '../status-renderers';

const message = {
  id: 'm1',
  role: 'assistant',
  createdAt: new Date(),
  content: { format: 2, parts: [] },
} satisfies MastraDBMessage;

describe('messageStatusRenderers', () => {
  it('renders the error notice', () => {
    const { getByText } = render(
      <>
        <ErrorStatusRenderer text="boom" message={message} />
      </>,
    );
    expect(getByText('Error')).not.toBeNull();
    expect(getByText('boom')).not.toBeNull();
  });

  it('renders the warning notice', () => {
    const { getByText } = render(
      <>
        <WarningStatusRenderer text="careful" message={message} />
      </>,
    );
    expect(getByText('Warning')).not.toBeNull();
    expect(getByText('careful')).not.toBeNull();
  });

  it('forwards tripwire metadata to the tripwire notice', () => {
    const { getByText } = render(
      <>
        <TripwireStatusRenderer
          text="blocked"
          tripwire={{ processorId: 'guard', reason: 'blocked' }}
          message={message}
        />
      </>,
    );
    expect(getByText('blocked')).not.toBeNull();
  });
});
