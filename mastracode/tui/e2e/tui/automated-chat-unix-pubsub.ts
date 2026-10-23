import { automatedChatScenario } from './automated-chat.js';
import type { McE2eScenario } from './types.js';

export const automatedChatUnixPubSubScenario: McE2eScenario = {
  ...automatedChatScenario,
  name: 'automated-chat-unix-pubsub',
  description: 'Submit one prompt with Unix socket pubsub enabled to catch thread ownership registration regressions.',
  testName: 'submits an automated chat prompt with Unix socket pubsub enabled',
  env: () =>
    ({
      MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB: null,
    }) as unknown as Record<string, string>,
};
