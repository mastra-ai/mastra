# @mastra/s2

Durable pub/sub for [Mastra](https://mastra.ai) [durable agents](https://mastra.ai/blog/introducing-durable-agents), backed by [S2](https://s2.dev).

## Installation

```bash
npm install @mastra/s2 @mastra/core
```

## Setup

1. Create an S2 [access token](https://s2.dev/docs/access-control) and set it as `S2_ACCESS_TOKEN`.
2. Create a basin with **Create Stream on Append** and **Create Stream on Read** enabled, and set it as `S2_BASIN`.

## Usage

Pass `S2PubSub` as the `pubsub` on your `Mastra` instance:

```typescript
import { Mastra } from '@mastra/core/mastra';
import { S2PubSub } from '@mastra/s2';
import { durableAgent } from './agents/durable-agent';

export const mastra = new Mastra({
  agents: { durableAgent },
  pubsub: new S2PubSub({
    accessToken: process.env.S2_ACCESS_TOKEN!,
    basin: process.env.S2_BASIN!,
  }),
});
```

## Configuration

`new S2PubSub(config, options?)`

| `config`      | Description                                                    |
| ------------- | -------------------------------------------------------------- |
| `accessToken` | S2 access token. Provide this or `client`.                     |
| `client`      | A pre-built `S2` client (takes precedence over `accessToken`). |
| `basin`       | S2 basin that stores the durable streams.                      |
| `endpoints`   | Optional endpoint overrides, e.g. for `s2-lite`.               |

| `options`      | Description                                                                    |
| -------------- | ------------------------------------------------------------------------------ |
| `inner`        | Live-delivery transport. Defaults to in-process `EventEmitterPubSub`.          |
| `streamPrefix` | S2 stream-name prefix. Defaults to `mastra/durable/`.                          |
| `topicPrefix`  | Only topics with this prefix are persisted to S2. Defaults to `agent.stream.`. |

Each durable-agent topic maps to one S2 stream: an event is appended per chunk. Replay reads the stream back from a sequence number.

## Cleanup and retention

Mastra deletes a run's stream shortly after the run completes. For streams that never get that may not be deleted explictly for example in case of a crashed process or orphaned runs: configure the basin's default stream config so they garbage-collect themselves as age-based retention trims old records, and delete-on-empty then removes the emptied stream.

```typescript
await s2.basins.create({
  basin: process.env.S2_BASIN!,
  config: {
    createStreamOnAppend: true,
    createStreamOnRead: true,
    defaultStreamConfig: {
      // Trim records older than 7 days, then delete the empty stream.
      retentionPolicy: { ageSecs: 7 * 24 * 60 * 60 },
      deleteOnEmpty: { minAgeSecs: 60 },
    },
  },
});
```

Keep retention comfortably longer than a run's lifetime plus its replay window as trimmed records are no longer on the stream.

## Testing

Set `S2_ACCESS_TOKEN` and run (the suite provisions and deletes its own throwaway basin, so `S2_BASIN` isn't needed):

```bash
S2_ACCESS_TOKEN=... pnpm --filter @mastra/s2 test
```

### Against s2-lite

To run against a local [s2-lite](https://s2.dev/docs) instead of the hosted service, point the endpoints at it. Either set the env vars (the integration test reads them via `S2Environment.parse()`):

```bash
S2_ACCESS_TOKEN=... \
  S2_ACCOUNT_ENDPOINT=http://localhost:4243 \
  S2_BASIN_ENDPOINT=http://localhost:4243 \
  pnpm --filter @mastra/s2 test
```

…or pass `endpoints` to `S2PubSub` in code:

```typescript
new S2PubSub({
  accessToken: process.env.S2_ACCESS_TOKEN!,
  basin: process.env.S2_BASIN!,
  endpoints: { account: 'http://localhost:4243', basin: 'http://localhost:4243' },
});
```

The basin endpoint may include a `{basin}` placeholder (e.g. `http://{basin}.localhost:4243`); a plain host applies to all basins. Adjust the URL/port to match your s2-lite instance.
