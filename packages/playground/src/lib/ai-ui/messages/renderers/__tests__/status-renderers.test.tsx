// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { MastraDBMessage } from '@mastra/react';
import { describe, expect, it } from 'vitest';
import { messageStatusRenderers } from '../status-renderers';

const message = {
  id: 'm1',
  role: 'assistant',
  createdAt: new Date(),
  content: { format: 2, parts: [] },
} as unknown as MastraDBMessage;

describe('messageStatusRenderers', () => {
  it('renders the error notice', () => {
    const Error = messageStatusRenderers.Error!;
    const { getByText } = render(<>{Error({ text: 'boom', message })}</>);
    expect(getByText('Error')).not.toBeNull();
    expect(getByText('boom')).not.toBeNull();
  });

  it('renders the warning notice', () => {
    const Warning = messageStatusRenderers.Warning!;
    const { getByText } = render(<>{Warning({ text: 'careful', message })}</>);
    expect(getByText('Warning')).not.toBeNull();
    expect(getByText('careful')).not.toBeNull();
  });

  it('forwards tripwire metadata to the tripwire notice', () => {
    const Tripwire = messageStatusRenderers.Tripwire!;
    const { getByText } = render(
      <>{Tripwire({ text: 'blocked', tripwire: { processorId: 'guard' }, message })}</>,
    );
    expect(getByText('blocked')).not.toBeNull();
  });
});
