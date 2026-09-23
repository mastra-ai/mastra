# @mastra/google-cloud-pubsub

`GoogleCloudPubSub` delivers Mastra events through Google Cloud Pub/Sub topics and subscriptions. Use it when multiple Mastra processes need durable, cross-host event delivery instead of the in-process event emitter.

## Installation

```bash
npm install @mastra/google-cloud-pubsub
```

## Usage

Authenticate with Application Default Credentials or set `GOOGLE_APPLICATION_CREDENTIALS` before starting Mastra.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { GoogleCloudPubSub } from '@mastra/google-cloud-pubsub';

export const mastra = new Mastra({
  pubsub: new GoogleCloudPubSub({
    projectId: process.env.GCP_PROJECT_ID!,
  }),
});
```

## Documentation

- [Reference: GoogleCloudPubSub](https://mastra.ai/reference/pubsub/google-cloud-pubsub)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/pubsub/google-cloud-pubsub/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
