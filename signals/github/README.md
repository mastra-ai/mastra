# @mastra/github-signals

`@mastra/github-signals` lets an agent subscribe a conversation thread to a GitHub pull request and receive new commits, review comments, thread-resolution changes, and merge or close events. Use it for long-running coding agents that need to resume work when a pull request changes.

## Installation

```bash
npm install @mastra/github-signals
```

## Usage

Register one `GithubSignals` instance on the agent that should receive pull request updates.

```typescript
import { Agent } from '@mastra/core/agent';
import { GithubSignals } from '@mastra/github-signals';

const githubSignals = new GithubSignals({ pollIntervalMs: 5 * 60 * 1000 });

export const reviewAgent = new Agent({
  id: 'review-agent',
  name: 'Pull request reviewer',
  instructions: 'Review pull requests and respond when new activity arrives.',
  model: 'openai/gpt-5.6-sol',
  signals: [githubSignals],
});
```

## Documentation

- [GitHub](https://mastra.ai/integrations/channels/github)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/signals/github/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
