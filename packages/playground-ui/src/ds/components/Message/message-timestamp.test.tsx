// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Message } from './message';
import { MessageTimestamp } from './message-timestamp';

afterEach(cleanup);

describe('MessageTimestamp', () => {
  it.each(['not-a-date', '', new Date(NaN)])('keeps the message visible when its timestamp is invalid (%s)', value => {
    const { container } = render(
      <Message from="assistant" footer={<MessageTimestamp value={value} />}>
        A readable reply
      </Message>,
    );

    expect(screen.getByText('A readable reply')).toBeTruthy();
    expect(container.querySelector('time')).toBeNull();
  });

  it.each(['2026-09-16T10:30:00.000Z', new Date('2026-09-16T10:30:00.000Z'), new Date(0)])(
    'renders a valid timestamp with its full date tooltip (%s)',
    value => {
      const { container } = render(<MessageTimestamp value={value} />);
      const time = container.querySelector('time');

      expect(time?.getAttribute('datetime')).toBe(new Date(value).toISOString());
      expect(time?.textContent).toBeTruthy();
      expect(time?.title).toBeTruthy();
    },
  );
});
