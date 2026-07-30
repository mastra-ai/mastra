import { describe, expect, it, vi } from 'vitest';

const { createAgentControllerSlackChannels } = vi.hoisted(() => ({
  createAgentControllerSlackChannels: vi.fn(() => ({}) as any),
}));

vi.mock('./slack.js', () => ({
  createAgentControllerSlackChannels,
  createGithubSourceControl: vi.fn(),
}));

import { SlackIntegration } from './integration.js';

describe('SlackIntegration', () => {
  it('forwards the factory work-items domain to its channel handlers', () => {
    const workItems = {};
    const channelIdentity = {};
    const projects = {};
    const integration = new SlackIntegration({ signingSecret: 'secret' });

    integration.channels({
      storage: { channelIdentity, projects },
      rules: { workItems },
    } as any);

    expect(createAgentControllerSlackChannels).toHaveBeenCalledWith(
      expect.objectContaining({
        accountLinks: channelIdentity,
        projects,
        workItems,
      }),
    );
  });
});
