// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SignalActivity } from './signal-activity';

afterEach(cleanup);

describe('SignalActivity', () => {
  it('wraps a message the inline line holds whole, since it has no body to open', () => {
    render(
      <SignalActivity
        kind="state"
        label="factory-environment"
        message="1 repository at /workspace"
        appearance="inline"
      />,
    );

    const message = screen.getByText('1 repository at /workspace');
    expect(message.classList).not.toContain('truncate');
    expect(message.classList).toContain('break-words');
  });
});
