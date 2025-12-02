# Deepgram JavaScript SDK

[![Discord](https://dcbadge.vercel.app/api/server/xWRaCDBtW4?style=flat)](https://discord.gg/xWRaCDBtW4) [![CI](https://github.com/deepgram/node-sdk/actions/workflows/CI.yml/badge.svg)](https://github.com/deepgram/node-sdk/actions/workflows/CI.yml) [![npm (scoped)](https://img.shields.io/npm/v/@deepgram/sdk)](https://www.npmjs.com/package/@deepgram/sdk) [![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v2.0%20adopted-ff69b4.svg?style=flat-rounded)](CODE_OF_CONDUCT.md)

Official JavaScript SDK for [Deepgram](https://www.deepgram.com/). Power your apps with world-class speech and Language AI models.

- [Migrating from earlier versions](#migrating-from-earlier-versions)
  - [V2 to V3](#v2-to-v3)
  - [V3.\* to V3.4](#v3-to-v34)
- [Installation](#installation)
  - [UMD](#umd)
  - [ESM](#esm)
- [Initialization](#initialization)
  - [Getting an API Key](#getting-an-api-key)
- [Scoped Configuration](#scoped-configuration)
  - [1. Global Defaults](#1-global-defaults)
  - [2. Namespace-specific Configurations](#2-namespace-specific-configurations)
  - [3. Transport Options](#3-transport-options)
  - [4. Examples](#4-examples)
    - [Change the API url used for all SDK methods](#change-the-api-url-used-for-all-sdk-methods)
    - [Change the API url used for transcription only](#change-the-api-url-used-for-transcription-only)
    - [Override fetch transmitter](#override-fetch-transmitter)
    - [Proxy requests in the browser](#proxy-requests-in-the-browser)
    - [Set custom headers for fetch](#set-custom-headers-for-fetch)
- [Transcription (Synchronous)](#transcription-synchronous)
  - [Remote Files](#remote-files)
  - [Local Files](#local-files)
- [Transcription (Asynchronous / Callbacks)](#transcription-asynchronous--callbacks)
  - [Remote Files](#remote-files-1)
  - [Local Files](#local-files-1)
- [Transcription (Live / Streaming)](#transcription-live--streaming)
  - [Live Audio](#live-audio)
- [Transcribing to captions](#transcribing-to-captions)
- [Voice Agent](#voice-agent)
- [Text to Speech](#text-to-speech)
- [Text Intelligence](#text-intelligence)
- [Authentication](#authentication)
  - [Get Token Details](#get-token-details)
- [Projects](#projects)
  - [Get Projects](#get-projects)
  - [Get Project](#get-project)
  - [Update Project](#update-project)
  - [Delete Project](#delete-project)
- [Keys](#keys)
  - [List Keys](#list-keys)
  - [Get Key](#get-key)
  - [Create Key](#create-key)
  - [Delete Key](#delete-key)
- [Members](#members)
  - [Get Members](#get-members)
  - [Remove Member](#remove-member)
- [Scopes](#scopes)
  - [Get Member Scopes](#get-member-scopes)
  - [Update Scope](#update-scope)
- [Invitations](#invitations)
  - [List Invites](#list-invites)
  - [Send Invite](#send-invite)
  - [Delete Invite](#delete-invite)
  - [Leave Project](#leave-project)
- [Usage](#usage)
  - [Get All Requests](#get-all-requests)
  - [Get Request](#get-request)
  - [Summarize Usage](#summarize-usage)
  - [Get Fields](#get-fields)
- [Billing](#billing)
  - [Get All Balances](#get-all-balances)
  - [Get Balance](#get-balance)
- [Models](#models)
  - [Get All Models](#get-all-models)
  - [Get Model](#get-model)
- [On-Prem APIs](#on-prem-apis)
  - [List On-Prem credentials](#list-on-prem-credentials)
  - [Get On-Prem credentials](#get-on-prem-credentials)
  - [Create On-Prem credentials](#create-on-prem-credentials)
  - [Delete On-Prem credentials](#delete-on-prem-credentials)
- [Backwards Compatibility](#backwards-compatibility)
- [Development and Contributing](#development-and-contributing)
  - [Debugging and making changes locally](#debugging-and-making-changes-locally)
- [Getting Help](#getting-help)

## Migrating from earlier versions

### V2 to V3

We have published [a migration guide on our docs](https://developers.deepgram.com/docs/js-sdk-v2-to-v3-migration-guide), showing how to move from v2 to v3.

### V3.\* to V3.4

We recommend using only documented interfaces, as we strictly follow semantic versioning (semver) and breaking changes may occur for undocumented interfaces. To ensure compatibility, consider pinning your versions if you need to use undocumented interfaces.

## Installation

You can install this SDK directly from [npm](https://www.npmjs.com/package/@deepgram/sdk).

```bash
npm install @deepgram/sdk
# - or -
# yarn add @deepgram/sdk
```

### UMD

You can now use plain `<script>`s to import deepgram from CDNs, like:

```html
<script src="https://cdn.jsdelivr.net/npm/@deepgram/sdk"></script>
```

or even:

```html
<script src="https://unpkg.com/@deepgram/sdk"></script>
```

Then you can use it from a global deepgram variable:

```html
<script>
  const { createClient } = deepgram;
  const _deepgram = createClient("deepgram-api-key");

  console.log("Deepgram Instance: ", _deepgram);
  // ...
</script>
```

### ESM

You can now use type="module" `<script>`s to import deepgram from CDNs, like:

```html
<script type="module">
  import { createClient } from "https://cdn.jsdelivr.net/npm/@deepgram/sdk/+esm";
  const deepgram = createClient("deepgram-api-key");

  console.log("Deepgram Instance: ", deepgram);
  // ...
</script>
```

## Initialization

```js
import { createClient } from "@deepgram/sdk";
// - or -
// const { createClient } = require("@deepgram/sdk");

const deepgram = createClient(DEEPGRAM_API_KEY);
```

### Getting an API Key

🔑 To access the Deepgram API you will need a [free Deepgram API Key](https://console.deepgram.com/signup?jump=keys).

## Scoped Configuration

The SDK supports scoped configuration. You'll be able to configure various aspects of each namespace of the SDK from the initialization. Below outlines a flexible and customizable configuration system for the Deepgram SDK. Here's how the namespace configuration works:

### 1. Global Defaults

- The `global` namespace serves as the foundational configuration applicable across all other namespaces unless overridden.
- Includes general settings like URL and headers applicable for all API calls.
- If no specific configurations are provided for other namespaces, the `global` defaults are used.

### 2. Namespace-specific Configurations

- Each namespace (`listen`, `manage`, `onprem`, `read`, `speak`) can have its specific configurations which override the `global` settings within their respective scopes.
- Allows for detailed control over different parts of the application interacting with various Deepgram API endpoints.

### 3. Transport Options

- Configurations for both `fetch` and `websocket` can be specified under each namespace, allowing different transport mechanisms for different operations.
- For example, the `fetch` configuration can have its own URL and proxy settings distinct from the `websocket`.
- The generic interfaces define a structure for transport options which include a client (like a `fetch` or `WebSocket` instance) and associated options (like headers, URL, proxy settings).

This configuration system enables robust customization where defaults provide a foundation, but every aspect of the client's interaction with the API can be finely controlled and tailored to specific needs through namespace-specific settings. This enhances the maintainability and scalability of the application by localizing configurations to their relevant contexts.

### 4. Examples

#### Change the API url used for all SDK methods

Useful for using different API environments (for e.g. beta).

```js
import { createClient } from "@deepgram/sdk";
// - or -
// const { createClient } = require("@deepgram/sdk");

const deepgram = createClient(DEEPGRAM_API_KEY, {
  global: { fetch: { options: { url: "https://api.beta.deepgram.com" } } },
});
```

#### Change the API url used for transcription only

Useful for on-prem installations. Only affects requests to `/listen` endpoints.

```js
import { createClient } from "@deepgram/sdk";
// - or -
// const { createClient } = require("@deepgram/sdk");

const deepgram = createClient(DEEPGRAM_API_KEY, {
  listen: { fetch: { options: { url: "http://localhost:8080" } } },
});
```

#### Override fetch transmitter

Useful for providing a custom http client.

```js
import { createClient } from "@deepgram/sdk";
// - or -
// const { createClient } = require("@deepgram/sdk");

const yourFetch = async () => {
  return Response("...etc");
};

const deepgram = createClient(DEEPGRAM_API_KEY, {
  global: { fetch: { client: yourFetch } },
});
```

#### Proxy requests in the browser

This SDK now works in the browser. If you'd like to make REST-based requests (pre-recorded transcription, on-premise, and management requests), then you'll need to use a proxy as we do not support custom CORS origins on our API. To set up your proxy, you configure the SDK like so:

```js
import { createClient } from "@deepgram/sdk";

const deepgram = createClient("proxy", {
  global: { fetch: { options: { proxy: { url: "http://localhost:8080" } } } },
});
```

> Important: You must pass `"proxy"` as your API key, and use the proxy to set the `Authorization` header to your Deepgram API key.

Your proxy service should replace the Authorization header with `Authorization: token <DEEPGRAM_API_KEY>` and return results verbatim to the SDK.

Check out our example Node-based proxy here: [Deepgram Node Proxy](https://github.com/deepgram-devs/deepgram-node-proxy).

#### Set custom headers for fetch

Useful for many things.

```js
import { createClient } from "@deepgram/sdk";

const deepgram = createClient("proxy", {
  global: { fetch: { options: { headers: { "x-custom-header": "foo" } } } },
});
```

## Transcription (Synchronous)

### Remote Files

```js
const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
  {
    url: "https://dpgr.am/spacewalk.wav",
  },
  {
    model: "nova",
  }
);
```

[See our API reference for more info](https://developers.deepgram.com/reference/pre-recorded).

### Local Files

```js
const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
  fs.createReadStream("./examples/spacewalk.wav"),
  {
    model: "nova",
  }
);
```

or

```js
const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
  fs.readFileSync("./examples/spacewalk.wav"),
  {
    model: "nova",
  }
);
```

[See our API reference for more info](https://developers.deepgram.com/reference/pre-recorded).

## Transcription (Asynchronous / Callbacks)

### Remote Files

```js
import { CallbackUrl } from "@deepgram/sdk";

const { result, error } = await deepgram.listen.prerecorded.transcribeUrlCallback(
  {
    url: "https://dpgr.am/spacewalk.wav",
  },
  new CallbackUrl("http://callback/endpoint"),
  {
    model: "nova",
  }
);
```

[See our API reference for more info](https://developers.deepgram.com/reference/pre-recorded).

### Local Files

```js
import { CallbackUrl } from "@deepgram/sdk";

const { result, error } = await deepgram.listen.prerecorded.transcribeFileCallback(
  fs.createReadStream("./examples/spacewalk.wav"),
  new CallbackUrl("http://callback/endpoint"),
  {
    model: "nova",
  }
);
```

or

```js
import { CallbackUrl } from "@deepgram/sdk";

const { result, error } = await deepgram.listen.prerecorded.transcribeFileCallback(
  fs.readFileSync("./examples/spacewalk.wav"),
  new CallbackUrl("http://callback/endpoint"),
  {
    model: "nova",
  }
);
```

[See our API reference for more info](https://developers.deepgram.com/reference/pre-recorded).

## Transcription (Live / Streaming)

### Live Audio

```js
const dgConnection = deepgram.listen.live({ model: "nova" });

dgConnection.on(LiveTranscriptionEvents.Open, () => {
  dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
    console.log(data);
  });

  source.addListener("got-some-audio", async (event) => {
    dgConnection.send(event.raw_audio_data);
  });
});
```

To see an example, [check out our Node.js example](https://github.com/deepgram-devs/node-live-example) or our [Browser example](https://github.com/deepgram-devs/js-live-example).

[See our API reference for more info](https://developers.deepgram.com/reference/streaming).

## Transcribing to captions

```js
import { webvtt /* , srt */ } from "@deepgram/captions";

const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
  {
    url: "https://dpgr.am/spacewalk.wav",
  },
  {
    model: "nova",
  }
);

const vttOutput = webvtt(result);
// const srtOutput = srt(result);
```

[See our standalone captions library for more information](https://github.com/deepgram/deepgram-node-captions).

## Voice Agent

```js
import { createClient } from "@deepgram/sdk";
import { AgentEvents } from "@deepgram/sdk";

const deepgram = createClient(DEEPGRAM_API_KEY);

// Create an agent connection
const agent = deepgram.agent();

// Set up event handlers
agent.on(AgentEvents.Open, () => {
  console.log("Connection opened");

  // Configure the agent once connection is established
  agent.configure({
    audio: {
      input: {
        encoding: "linear16",
        sampleRate: 16000,
      },
      output: {
        encoding: "linear16",
        container: "wav",
        sampleRate: 24000,
      },
    },
    agent: {
      listen: {
        model: "nova-3",
      },
      speak: {
        model: "aura-asteria-en",
      },
      think: {
        provider: {
          type: "anthropic",
        },
        model: "claude-3-haiku-20240307",
        instructions: "You are a helpful AI assistant. Keep responses brief and friendly.",
      },
    },
  });
});

// Handle agent responses
agent.on(AgentEvents.AgentStartedSpeaking, (data) => {
  console.log("Agent started speaking:", data["total_latency"]);
});

agent.on(AgentEvents.ConversationText, (message) => {
  console.log(`${message.role} said: ${message.content}`);
});

agent.on(AgentEvents.Audio, (audio) => {
  // Handle audio data from the agent
  playAudio(audio); // Your audio playback implementation
});

agent.on(AgentEvents.Error, (error) => {
  console.error("Error:", error);
});

agent.on(AgentEvents.Close, () => {
  console.log("Connection closed");
});

// Send audio data
function sendAudioData(audioData) {
  agent.send(audioData);
}

// Keep the connection alive
setInterval(() => {
  agent.keepAlive();
}, 8000);
```

This example demonstrates:

- Setting up a WebSocket connection
- Configuring the agent with speech, language, and audio settings
- Handling various agent events (speech, transcripts, audio)
- Sending audio data and keeping the connection alive

For a complete implementation, you would need to:

1. Add your audio input source (e.g., microphone)
2. Implement audio playback for the agent's responses
3. Handle any function calls if your agent uses them
4. Add proper error handling and connection management

[See our API reference for more info](https://developers.deepgram.com/reference/voice-agent-api/agent)

## Text to Speech

### Rest

```js
const { result } = await deepgram.speak.request({ text }, { model: "aura-2-thalia-en" });
```

### Websocket

```js
const dgConnection = deepgram.speak.live({ model: "aura-asteria-en" });

dgConnection.on(LiveTTSEvents.Open, () => {
  console.log("Connection opened");

  // Send text data for TTS synthesis
  dgConnection.sendText(text);

  // Send Flush message to the server after sending the text
  dgConnection.flush();

  dgConnection.on(LiveTTSEvents.Close, () => {
    console.log("Connection closed");
  });
});
```

[See our API reference for more info](https://developers.deepgram.com/reference/text-to-speech-api).

## Text Intelligence

```js
const text = `The history of the phrase 'The quick brown fox jumps over the
lazy dog'. The earliest known appearance of the phrase was in The Boston
Journal. In an article titled "Current Notes" in the February 9, 1885, edition,
the phrase is mentioned as a good practice sentence for writing students: "A
favorite copy set by writing teachers for their pupils is the following,
because it contains every letter of the alphabet: 'A quick brown fox jumps over
the lazy dog.'" Dozens of other newspapers published the phrase over the
next few months, all using the version of the sentence starting with "A" rather
than "The". The earliest known use of the phrase starting with "The" is from
the 1888 book Illustrative Shorthand by Linda Bronson.[3] The modern form
(starting with "The") became more common even though it is slightly longer than
the original (starting with "A").`;

const { result, error } = await deepgram.read.analyzeText(
  { text },
  { language: "en", topics: true, sentiment: true }
);
```

[See our API reference for more info](https://developers.deepgram.com/reference/analyze-text).

## Authentication

### Get Token Details

Retrieves the details of the current authentication token.

```js
const { result, error } = await deepgram.manage.getTokenDetails();
```

[See our API reference for more info](https://developers.deepgram.com/reference/authentication)

## Projects

### Get Projects

Returns all projects accessible by the API key.

```js
const { result, error } = await deepgram.manage.getProjects();
```

[See our API reference for more info](https://developers.deepgram.com/reference/get-projects).

### Get Project

Retrieves a specific project based on the provided project_id.

```js
const { result, error } = await deepgram.manage.getProject(projectId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/get-project).

### Update Project

Update a project.

```js
const { result, error } = await deepgram.manage.updateProject(projectId, options);
```

[See our API reference for more info](https://developers.deepgram.com/reference/update-project).

## Delete Project

Delete a project.

```js
const { error } = await deepgram.manage.deleteProject(projectId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/delete-project).

## Keys

### List Keys

Retrieves all keys associated with the provided project_id.

```js
const { result, error } = await deepgram.manage.getProjectKeys(projectId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/list-keys).

### Get Key

Retrieves a specific key associated with the provided project_id.

```js
const { result, error } = await deepgram.manage.getProjectKey(projectId, projectKeyId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/get-key).

### Create Key

Creates an API key with the provided scopes.

```js
const { result, error } = await deepgram.manage.createProjectKey(projectId, options);
```

[See our API reference for more info](https://developers.deepgram.com/reference/create-key).

### Delete Key

Deletes a specific key associated with the provided project_id.

```js
const { error } = await deepgram.manage.deleteProjectKey(projectId, projectKeyId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/delete-key).

## Members

### Get Members

Retrieves account objects for all of the accounts in the specified project_id.

```js
const { result, error } = await deepgram.manage.getProjectMembers(projectId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/get-members).

### Remove Member

Removes member account for specified member_id.

```js
const { error } = await deepgram.manage.removeProjectMember(projectId, projectMemberId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/remove-member).

## Scopes

### Get Member Scopes

Retrieves scopes of the specified member in the specified project.

```js
const { result, error } = await deepgram.manage.getProjectMemberScopes(projectId, projectMemberId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/get-member-scopes).

### Update Scope

Updates the scope for the specified member in the specified project.

```js
const { result, error } = await deepgram.manage.updateProjectMemberScope(
  projectId,
  projectMemberId,
  options
);
```

[See our API reference for more info](https://developers.deepgram.com/reference/update-scope).

## Invitations

### List Invites

Retrieves all invitations associated with the provided project_id.

```js
const { result, error } = await deepgram.manage.getProjectInvites(projectId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/list-invites).

### Send Invite

Sends an invitation to the provided email address.

```js
const { result, error } = await deepgram.manage.sendProjectInvite(projectId, options);
```

[See our API reference for more info](https://developers.deepgram.com/reference/send-invites).

### Delete Invite

Removes the specified invitation from the project.

```js
const { error } = await deepgram.manage.deleteProjectInvite(projectId, email);
```

[See our API reference for more info](https://developers.deepgram.com/reference/delete-invite).

### Leave Project

Removes the authenticated user from the project.

```js
const { result, error } = await deepgram.manage.leaveProject(projectId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/leave-project).

## Usage

### Get All Requests

Retrieves all requests associated with the provided project_id based on the provided options.

```js
const { result, error } = await deepgram.manage.getProjectUsageRequests(projectId, options);
```

### Get Request

Retrieves a specific request associated with the provided project_id.

```js
const { result, error } = await deepgram.manage.getProjectUsageRequest(projectId, requestId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/get-request).

### Summarize Usage

Retrieves usage associated with the provided project_id based on the provided options.

```js
const { result, error } = await deepgram.manage.getProjectUsageSummary(projectId, options);
```

[See our API reference for more info](https://developers.deepgram.com/reference/summarize-usage).

### Get Fields

Lists the features, models, tags, languages, and processing method used for requests in the specified project.

```js
const { result, error } = await deepgram.manage.getProjectUsageFields(projectId, options);
```

[See our API reference for more info](https://developers.deepgram.com/reference/get-fields).

## Billing

### Get All Balances

Retrieves the list of balance info for the specified project.

```js
const { result, error } = await deepgram.manage.getProjectBalances(projectId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/get-all-balances).

### Get Balance

Retrieves the balance info for the specified project and balance_id.

```js
const { result, error } = await deepgram.manage.getProjectBalance(projectId, balanceId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/get-balance).

## Models

### Get All Models

Retrieves all models available for a given project.

```js
const { result, error } = await deepgram.manage.getAllModels(projectId, {});
```

[See our API reference for more info](https://developers.deepgram.com/reference/management-api/models/list)

### Get Model

Retrieves details of a specific model.

```js
const { result, error } = await deepgram.manage.getModel(projectId, modelId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/management-api/models/get)

## On-Prem APIs

### List On-Prem credentials

```js
const { result, error } = await deepgram.onprem.listCredentials(projectId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/self-hosted-api/list-credentials)

### Get On-Prem credentials

```js
const { result, error } = await deepgram.onprem.getCredentials(projectId, credentialId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/self-hosted-api/get-credentials)

### Create On-Prem credentials

```js
const { result, error } = await deepgram.onprem.createCredentials(projectId, options);
```

[See our API reference for more info](https://developers.deepgram.com/reference/self-hosted-api/create-credentials)

### Delete On-Prem credentials

```js
const { result, error } = await deepgram.onprem.deleteCredentials(projectId, credentialId);
```

[See our API reference for more info](https://developers.deepgram.com/reference/self-hosted-api/delete-credentials)

## Backwards Compatibility

Older SDK versions will receive Priority 1 (P1) bug support only. Security issues, both in our code and dependencies, are promptly addressed. Significant bugs without clear workarounds are also given priority attention.

We strictly follow semver, and will not introduce breaking changes to the publicly documented interfaces of the SDK. **Use internal and undocumented interfaces without pinning your version, at your own risk.**

## Development and Contributing

Interested in contributing? We ❤️ pull requests!

To make sure our community is safe for all, be sure to review and agree to our
[Code of Conduct](./CODE_OF_CONDUCT.md). Then see the
[Contribution](./CONTRIBUTING.md) guidelines for more information.

### Debugging and making changes locally

If you want to make local changes to the SDK and run the [`examples/`](./examples/), you'll need to `npm run build` first, to ensure that your changes are included in the examples that are running.

## Getting Help

We love to hear from you so if you have questions, comments or find a bug in the
project, let us know! You can either:

- [Open an issue in this repository](https://github.com/deepgram/deepgram-node-sdk/issues/new)
- [Join the Deepgram Discord Community](https://discord.gg/xWRaCDBtW4)
- [Join the Deepgram Github Discussions Community](https://github.com/orgs/deepgram/discussions)
