import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, render } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentColorProvider } from '../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../schemas';

import { ChatComposer } from '../chat-composer';

const noop = () => {};

interface RenderOptions {
  agentId?: string;
}

const FormHarness = ({ agentId = 'agent_test', children }: { agentId?: string; children: React.ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {} as AgentBuilderEditFormValues,
  });
  return (
    <FormProvider {...methods}>
      <AgentColorProvider agentId={agentId}>{children}</AgentColorProvider>
    </FormProvider>
  );
};

const renderComposer = (
  props: Partial<React.ComponentProps<typeof ChatComposer>> = {},
  { agentId = 'agent_test' }: RenderOptions = {},
) =>
  render(
    <TooltipProvider>
      <FormHarness agentId={agentId}>
        <ChatComposer
          draft=""
          onDraftChange={noop}
          onSubmit={e => e.preventDefault()}
          onKeyDown={noop}
          disabled={false}
          canSubmit={true}
          inputTestId="composer-input"
          submitTestId="composer-submit"
          containerTestId="composer-container"
          {...props}
        />
      </FormHarness>
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

  it('applies agent-color CSS variables to the composer container derived from the agentId', () => {
    const { getByTestId } = renderComposer({}, { agentId: 'agent_support' });
    const container = getByTestId('composer-container') as HTMLDivElement;
    expect(container.style.getPropertyValue('--agent-color-fg')).toMatch(/^hsl\(/);
    expect(container.style.getPropertyValue('--agent-color-bg')).toMatch(/^hsl\(/);
    expect(container.className).toContain('border-border1');
    expect(container.className).toContain('focus-within:border-[var(--agent-color-bg)]');
    expect(container.className).not.toContain('focus-within:ring');
  });
});
