# openai-realtime-api <!-- omit from toc -->

> TypeScript client for OpenAI's realtime voice API.

<p>
  <a href="https://github.com/transitive-bullshit/openai-realtime-api/actions/workflows/main.yml"><img alt="Build Status" src="https://github.com/transitive-bullshit/openai-realtime-api/actions/workflows/main.yml/badge.svg" /></a>
  <a href="https://www.npmjs.com/package/openai-realtime-api"><img alt="NPM" src="https://img.shields.io/npm/v/openai-realtime-api.svg" /></a>
  <a href="https://github.com/transitive-bullshit/openai-realtime-api/blob/main/license"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue" /></a>
  <a href="https://prettier.io"><img alt="Prettier Code Formatting" src="https://img.shields.io/badge/code_style-prettier-brightgreen.svg" /></a>
</p>

- [Features](#features)
- [Install](#install)
- [Usage](#usage)
  - [Server Usage](#server-usage)
  - [Browser Usage](#browser-usage)
  - [Relay Server](#relay-server)
- [Examples](#examples)
  - [Node.js Basic](#nodejs-basic)
  - [Node.js Audio](#nodejs-audio)
  - [Node.js Conversation](#nodejs-conversation)
  - [OpenAI Realtime Console](#openai-realtime-console)
- [TODO](#todo)
- [License](#license)

## Features

- **Strongly typed** TS fork of [openai/openai-realtime-api-beta](https://github.com/openai/openai-realtime-api-beta)
- [All events](./src/events.ts) and handlers are 100% typed
- **Drop-in replacement for OpenAI's JS version**
- Fixes many small bugs and inconsistencies
  - ([#3](https://github.com/openai/openai-realtime-api-beta/issues/3), [#11](https://github.com/openai/openai-realtime-api-beta/pull/11), [#12](https://github.com/openai/openai-realtime-api-beta/pull/12), [#14](https://github.com/openai/openai-realtime-api-beta/issues/14), [#17](https://github.com/openai/openai-realtime-api-beta/pull/17), [#29](https://github.com/openai/openai-realtime-api-beta/pull/29), [#34](https://github.com/openai/openai-realtime-api-beta/pull/34), [#35](https://github.com/openai/openai-realtime-api-beta/pull/35), [#37](https://github.com/openai/openai-realtime-api-beta/pull/37), [#43](https://github.com/openai/openai-realtime-api-beta/pull/43), [#44](https://github.com/openai/openai-realtime-api-beta/pull/44), and likely others)
- Published to NPM
- Supports Node.js, browser, deno, bun, CF workers, etc
- Includes Node.js CLI examples for easy local testing
- Includes a simple relay server
- Includes the [OpenAI Realtime Console demo](#openai-realtime-console) using this package 🔥

## Install

```sh
npm install openai-realtime-api
```

This package is [ESM-only](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c). It requires `Node.js >= 18`, a browser environment, or an equivalent JS runtime (Deno, Bun, CF workers, etc).

## Usage

> [!IMPORTANT]
> All usage and events are 100% compatible with the [OpenAI JS version](https://github.com/openai/openai-realtime-api-beta). The main difference aside from bug fixes is that **all events are fully-typed**.

```ts
import { RealtimeClient } from 'openai-realtime-api'

// Create a new client; all params are optional; apiKey defaults to the
// `OPENAI_API_KEY` environment variable (when using Node.js).
const client = new RealtimeClient({
  sessionConfig: {
    instructions: 'You are a great, upbeat friend.',
    voice: 'alloy'
  }
})

// Can change session config ahead of connecting.
client.updateSession({
  turn_detection: null,
  input_audio_transcription: { model: 'whisper-1' }
})

// Example of custom event handling
client.on('conversation.updated', (event) => {
  // All events are fully-typed based on the event name.
  // In this case, `event` will have the type `RealtimeCustomEvents.ConversationUpdatedEvent`
  const { item, delta } = event

  // Access the full list of conversation items.
  const items = client.conversation.getItems()
})

// Connect to the Realtime API.
await client.connect()

// Send a text message and trigger a response generation.
client.sendUserMessageContent([{ type: 'input_text', text: 'How are you?' }])

// Wait for a completed response from the model.
// (`event` will be of type `RealtimeServerEvents.ResponseDoneEvent`)
const event = await client.realtime.waitForNext('response.done')
```

See [examples](#examples) for more complete demos.

See also the official [OpenAI Realtime API Guide](https://platform.openai.com/docs/guides/realtime) and [API Reference](https://platform.openai.com/docs/api-reference/realtime).

For more info on usage, tools, and custom events, see [OpenAI's readme](https://github.com/openai/openai-realtime-api-beta). Note that this package is 100% compatible with OpenAI's beta package in terms of both official and unofficial events. The only difference is that all events are typed.

### Server Usage

`RealtimeClient` takes in an optional `apiKey` which defaults to `process.env.OPENAI_API_KEY`.

### Browser Usage

`RealtimeClient` takes in an optional `url` which can be pointed at a relay server.

```ts
import { RealtimeClient } from 'openai-realtime-api'

// Create a browser client which points to a relay server.
const client = new RealtimeClient({ url: RELAY_SERVER_URL })
```

Alternatively, you can use `apiKey` with `RealtimeClient` in the browser, but you also have to pass `dangerouslyAllowAPIKeyInBrowser: true`.

```ts
import { RealtimeClient } from 'openai-realtime-api'

// Create a browser client which connects directly to the OpenAI realtime API
// with an unsafe, client-side API key.
const client = new RealtimeClient({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowAPIKeyInBrowser: true
})
```

> [!CAUTION]
> We strongly recommend against including your API key in any client (mobile or browser). It can be useful for local testing, but for production, you should be using a relay server.

### Relay Server

```ts
import { RealtimeClient } from 'openai-realtime-api'
import { RealtimeRelay } from 'openai-realtime-api/node'

// Setting `relay: true` disables tool calls and directly modifying the session,
// since that will be the responsibility of the upstream client.
const client = new RealtimeClient({ relay: true })
const relay = new RealtimeRelay({ client })

relay.listen(8081)
```

Note that `RealtimeRelay` uses a different import path because it contains Node.js-specific code.

A full example is included in [examples/node/relay-server.ts](./examples/node/relay-server.ts).

## Examples

To run the included examples (requires `Node.js >= 18`):

1. Clone this repo
2. Run `pnpm install`
3. Setup `.env` with your `OPENAI_API_KEY`

You can set `debug: true` in the `RealtimeClient` constructor of these examples to print out the full event log.

### Node.js Basic

Simple Node.js demo using the `RealtimeClient` which sends a text message and waits for a complete response.

- [examples/node/basic.ts](./examples/node/basic.ts)
- Run `npx tsx examples/node/basic.ts`

### Node.js Audio

Simple Node.js demo using the `RealtimeClient` which sends a short audio message and waits for a complete response.

- [examples/node/audio.ts](./examples/node/audio.ts)
- Run `npx tsx examples/node/audio.ts`

### Node.js Conversation

Simple Node.js demo using the `RealtimeClient` with a microphone and speaker to simulate a full, back & forth conversation from the terminal.

- [examples/node/convo.ts](./examples/node/convo.ts)
- This demo uses the [mic](https://github.com/ashishbajaj99/mic) and [speaker](https://github.com/TooTallNate/node-speaker) npm packages
- `mic` requires [sox](https://sourceforge.net/projects/sox/); on macOS, you can run `brew install sox`
- `npx tsx examples/node/convo.ts`

### OpenAI Realtime Console

This example has been imported from https://github.com/openai/openai-realtime-console ([at commit 6ea4dba](https://github.com/openai/openai-realtime-console/tree/6ea4dba795fee868c60ea9e8e7eba7469974b3e9)). The only change has been to replace `@openai/realtime-api-beta` with `openai-realtime-api` and to fix a few types.

<img src="/examples/openai-realtime-console/readme/realtime-console-demo.png" width="800" />

To run the realtime console example:

```sh
pnpm install
cd examples/openai-realtime-console
pnpm start
```

## TODO

- add an example using tools
- add an example next.js app
- improve readme docs

## License

MIT © [Travis Fischer](https://x.com/transitive_bs)

If you found this project interesting, [consider following me on Twitter](https://x.com/transitive_bs).
