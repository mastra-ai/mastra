// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { PlaygroundModelProvider } from '../../context/playground-model-context';
import { ComposerContextUsage, formatTokens } from '../composer-context-usage';
import type { ComposerContextUsageProps } from '../composer-context-usage';
import { v2Agent } from './fixtures/composer-model-settings';
import { ConversationUsageContext, EMPTY_CONVERSATION_USAGE } from '@/lib/ai-ui/chat/conversation-usage-context';
import type { ConversationUsage } from '@/lib/ai-ui/chat/conversation-usage-context';
import { MODELS_DEV_API_URL } from '@/domains/agents/hooks/use-model-context-window';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const usageWithRuns: ConversationUsage = {
  lastStep: { inputTokens: 24_000, outputTokens: 350, totalTokens: 24_350, cachedInputTokens: 12_000 },
  cumulative: { inputTokens: 40_000, outputTokens: 900, totalTokens: 40_900 },
  runCount: 2,
};

const modelsDevCatalog = {
  openai: {
    models: {
      'gpt-5-mini': { limit: { context: 200_000, output: 100_000 } },
    },
  },
};

const renderUsage = (
  usage: ConversationUsage,
  { provider = 'openai', model = 'gpt-5-mini', ...props }: { provider?: string; model?: string } & ComposerContextUsageProps = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <PlaygroundModelProvider defaultProvider={provider} defaultModel={model}>
            <ConversationUsageContext.Provider value={usage}>
              <ComposerContextUsage {...props} />
            </ConversationUsageContext.Provider>
          </PlaygroundModelProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const openPopover = async () => {
  const trigger = await screen.findByTestId('composer-context-usage-trigger');
  await act(async () => {
    fireEvent.click(trigger);
  });
};

afterEach(() => cleanup());

describe('formatTokens', () => {
  it('formats token counts compactly', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(24_000)).toBe('24k');
    expect(formatTokens(1_500_000)).toBe('1.5M');
  });
});

describe('ComposerContextUsage', () => {
  it('shows the agent context breakdown even before any usage is measured', async () => {
    server.use(
      http.get(MODELS_DEV_API_URL, () => HttpResponse.json(modelsDevCatalog)),
      http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
    );

    renderUsage(EMPTY_CONVERSATION_USAGE, { agentId: 'agent-1', hasMemory: false });
    await openPopover();

    expect(await screen.findByText(/send a message to measure/i)).not.toBeNull();
    // Static breakdown of what every request carries
    expect(await screen.findByTestId('composer-context-usage-breakdown')).not.toBeNull();
    expect(await screen.findByText('System prompt')).not.toBeNull();
    expect(await screen.findByText('Tools')).not.toBeNull();
    expect(await screen.findByText('Memory')).not.toBeNull();
    // Known context window is surfaced ahead of the first run
    expect(await screen.findByText('Context window')).not.toBeNull();
    expect(await screen.findByText('200k')).not.toBeNull();
  });

  it('shows the context percentage when the model context window is known', async () => {
    server.use(http.get(MODELS_DEV_API_URL, () => HttpResponse.json(modelsDevCatalog)));

    renderUsage(usageWithRuns);
    await openPopover();

    // 24k of 200k = 12%
    expect(await screen.findByText('12%')).not.toBeNull();
    expect(await screen.findByText('24k / 200k')).not.toBeNull();
    expect(await screen.findByText('Cached input')).not.toBeNull();
    expect(await screen.findByText(/conversation total \(2 runs\)/i)).not.toBeNull();
  });

  it('falls back to absolute token counts when the context window is unknown', async () => {
    server.use(http.get(MODELS_DEV_API_URL, () => HttpResponse.json({})));

    renderUsage(usageWithRuns, { provider: 'custom', model: 'mystery-model' });
    await openPopover();

    expect(await screen.findByText('24k')).not.toBeNull();
    expect(screen.queryByText('12%')).toBeNull();
    expect(screen.queryByText(/\s\/\s/)).toBeNull();
  });
});
