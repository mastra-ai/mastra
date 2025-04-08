# @mastra/voice-cloudflare

Cloudflare Voice integration for Mastra, providing Text-to-Speech (TTS) capabilities using open source speech models.

## Installation

```bash
npm install @mastra/voice-cloudflare
```

## Configuration

The module requires the following environment variables:

If using Cloudflare Native Bindings:

`./wrangler.jsonc`

```json
"ai": {
    "binding": "AI",
  },
```

If using Cloudflare REST API:

```bash
CLOUDFLARE_AI_API_KEY=your_api_key
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

## Usage

```typescript
import { CloudflareVoice } from '@mastra/voice-cloudflare';

// Native Bindings
const voice = new CloudflareVoice({
  binding: env.AI,
  listeningModel: {
    model: '@cf/openai/whisper-large-v3-turbo',
  },
});

// REST API
const voice = new CloudflareVoice({
  listeningModel: {
    apiKey: 'YOUR_API_KEY',
    model: '@cf/openai/whisper-large-v3-turbo',
    account_id: 'YOUR_ACC_ID',
  },
});

// Generate Text from an audio stream
const text = await voice.listen(audioStream);
```

## Features

- Open source models

## Available Models

### Speech Models

The following speech-to-text models are available:

| Model                               | Description                    |
| ----------------------------------- | ------------------------------ |
| `@cf/openai/whisper-tiny-en`        | Lightweight English-only model |
| `@cf/openai/whisper`                | Standard multilingual model    |
| `@cf/openai/whisper-large-v3-turbo` | High-accuracy turbo model      |
