// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatComposer } from '../chat-composer';

const noop = () => {};

const renderComposer = (props: Partial<React.ComponentProps<typeof ChatComposer>> = {}) =>
  render(
    <TooltipProvider>
      <ChatComposer
        draft=""
        onDraftChange={noop}
        onSubmit={e => e.preventDefault()}
        onKeyDown={noop}
        disabled={false}
        canSubmit={true}
        inputTestId="composer-input"
        submitTestId="composer-submit"
        {...props}
      />
    </TooltipProvider>,
  );

describe('ChatComposer', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows Send tooltip and no spinner when not running', () => {
    const { getByTestId } = renderComposer({ isRunning: false });
    const submit = getByTestId('composer-submit');
    expect(submit.getAttribute('aria-label')).toBe('Send');
    expect(submit.querySelector('.animate-spin')).toBeNull();
  });

  it('shows spinner and Generating tooltip when running, with disabled textarea + submit', () => {
    const { getByTestId } = renderComposer({
      isRunning: true,
      disabled: true,
      canSubmit: false,
    });
    const submit = getByTestId('composer-submit');
    const textarea = getByTestId('composer-input') as HTMLTextAreaElement;

    expect(submit.getAttribute('aria-label')).toBe('Generating…');
    expect(submit.querySelector('.animate-spin')).not.toBeNull();
    expect(submit.hasAttribute('disabled')).toBe(true);
    expect(textarea.disabled).toBe(true);
  });
});
