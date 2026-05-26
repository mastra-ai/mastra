import { describe, it, expect, vi } from 'vitest';

import { connectAgentToSlackTool } from './connect-agent-to-slack';

type ExecuteFn = NonNullable<typeof connectAgentToSlackTool.execute>;
type ExecuteContext = Parameters<ExecuteFn>[1];

type ToolResult = {
  success: boolean;
  message: string;
  url?: string;
  error?: string;
};

const callExecute = async (
  inputData: { agentId: string },
  mastra: unknown,
): Promise<ToolResult> => {
  const execute = connectAgentToSlackTool.execute as ExecuteFn;
  const result = await execute(inputData, { mastra } as unknown as ExecuteContext);
  return result as ToolResult;
};

describe('connectAgentToSlackTool', () => {
  it('returns a not-configured error when no slack channel provider is registered', async () => {
    const mastra = { getChannelProvider: vi.fn().mockReturnValue(undefined) };

    const result = await callExecute({ agentId: 'agent-1' }, mastra);

    expect(result).toEqual({
      success: false,
      message: 'Slack is not configured for this project.',
      error: 'slack-not-configured',
    });
    expect(mastra.getChannelProvider).toHaveBeenCalledWith('slack');
  });

  it('returns a not-configured error when the provider has no connect method', async () => {
    const slack = { getInfo: () => ({ isConfigured: true }) };
    const mastra = { getChannelProvider: vi.fn().mockReturnValue(slack) };

    const result = await callExecute({ agentId: 'agent-1' }, mastra);

    expect(result).toEqual({
      success: false,
      message: 'Slack is not configured for this project.',
      error: 'slack-not-configured',
    });
  });

  it('returns the authorizationUrl verbatim for an oauth result', async () => {
    const slack = {
      connect: vi.fn().mockResolvedValue({
        type: 'oauth',
        authorizationUrl: 'https://slack.com/oauth/v2/authorize?state=abc',
        installationId: 'install-1',
      }),
    };
    const mastra = { getChannelProvider: vi.fn().mockReturnValue(slack) };

    const result = await callExecute({ agentId: 'agent-1' }, mastra);

    expect(result.success).toBe(true);
    expect(result.url).toBe('https://slack.com/oauth/v2/authorize?state=abc');
    expect(result.message).toBe(
      'Follow this link to connect your agent to Slack: https://slack.com/oauth/v2/authorize?state=abc',
    );
    expect(slack.connect).toHaveBeenCalledWith('agent-1');
  });

  it('returns the deep link url verbatim for a deep_link result', async () => {
    const slack = {
      connect: vi.fn().mockResolvedValue({
        type: 'deep_link',
        url: 'slack://channel?team=T1&id=C1',
        installationId: 'install-1',
      }),
    };
    const mastra = { getChannelProvider: vi.fn().mockReturnValue(slack) };

    const result = await callExecute({ agentId: 'agent-1' }, mastra);

    expect(result.success).toBe(true);
    expect(result.url).toBe('slack://channel?team=T1&id=C1');
    expect(result.message).toBe(
      'Follow this link to connect your agent to Slack: slack://channel?team=T1&id=C1',
    );
  });

  it('returns a success message with no url for an immediate result', async () => {
    const slack = {
      connect: vi.fn().mockResolvedValue({ type: 'immediate', installationId: 'install-1' }),
    };
    const mastra = { getChannelProvider: vi.fn().mockReturnValue(slack) };

    const result = await callExecute({ agentId: 'agent-1' }, mastra);

    expect(result).toEqual({
      success: true,
      message: 'Your agent is now connected to Slack.',
    });
  });

  it('treats getInfo().isConfigured === false as not configured', async () => {
    const slack = {
      getInfo: () => ({ isConfigured: false }),
      connect: vi.fn(),
    };
    const mastra = { getChannelProvider: vi.fn().mockReturnValue(slack) };

    const result = await callExecute({ agentId: 'agent-1' }, mastra);

    expect(result).toEqual({
      success: false,
      message: 'Slack is not configured for this project.',
      error: 'slack-not-configured',
    });
    expect(slack.connect).not.toHaveBeenCalled();
  });

  it('returns the error message when connect throws', async () => {
    const slack = {
      connect: vi.fn().mockRejectedValue(new Error('rate limited')),
    };
    const mastra = { getChannelProvider: vi.fn().mockReturnValue(slack) };

    const result = await callExecute({ agentId: 'agent-1' }, mastra);

    expect(result).toEqual({
      success: false,
      message: 'Could not generate a Slack connect link.',
      error: 'rate limited',
    });
  });

  it('returns a mastra-missing error when execute has no mastra context', async () => {
    const result = await callExecute({ agentId: 'agent-1' }, undefined);

    expect(result).toEqual({
      success: false,
      message: 'Slack is not available in this environment.',
      error: 'mastra-missing',
    });
  });
});
