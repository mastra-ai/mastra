---
title: 音声対話
description: Mastra における音声対音声機能の概要。リアルタイム対話やイベント駆動型アーキテクチャを含みます。
---

# Mastra の音声間変換機能 \{#speech-to-speech-capabilities-in-mastra\}

## はじめに \{#introduction\}

Mastra の Speech-to-Speech (STS) は、複数プロバイダー間のリアルタイム対話に向けた標準化インターフェースを提供します。\
STS は Realtime モデルのイベントを購読して、双方向の音声通信を継続的に実現します。個別の TTS/STT 処理とは異なり、STS は双方向の音声を継続的に処理するオープンな接続を維持します。

## 設定 \{#configuration\}

* **`apiKey`**: OpenAI の API キー。指定がない場合は `OPENAI_API_KEY` 環境変数が使用されます。
* **`model`**: リアルタイムの音声対話に使用するモデル ID（例: `gpt-4o-mini-realtime`）。
* **`speaker`**: 音声合成で使用するデフォルトの音声 ID。音声出力に使う声を指定できます。

```typescript
const voice = new OpenAIRealtimeVoice({
  apiKey: 'your-openai-api-key',
  model: 'gpt-4o-mini-realtime',
  speaker: 'alloy', // デフォルトの音声
});

// デフォルト設定を使用する場合、設定を次のように簡略化できます:
const voice = new OpenAIRealtimeVoice();
```

## STS の利用 \{#using-sts\}

```typescript
import { Agent } from '@mastra/core/agent';
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { playAudio, getMicrophoneStream } from '@mastra/node-audio';

const agent = new Agent({
  name: 'Agent',
  instructions: `リアルタイム音声機能を持つ親切なアシスタントです。`,
  model: openai('gpt-4o'),
  voice: new OpenAIRealtimeVoice(),
});

// 音声サービスに接続
await agent.voice.connect();

// エージェントの音声応答をリッスン
agent.voice.on('speaker', ({ audio }) => {
  playAudio(audio);
});

// 会話を開始
await agent.voice.speak('本日はどのようなご用件でしょうか?');

// マイクから継続的に音声を送信
const micStream = getMicrophoneStream();
await agent.voice.send(micStream);
```

エージェントに音声対音声（Speech-to-Speech）機能を統合する場合は、[Adding Voice to Agents](../agents/adding-voice) のドキュメントを参照してください。

## Google Gemini Live（リアルタイム） \{#google-gemini-live-realtime\}

```typescript
import { Agent } from '@mastra/core/agent';
import { GeminiLiveVoice } from '@mastra/voice-google-gemini-live';
import { playAudio, getMicrophoneStream } from '@mastra/node-audio';

const agent = new Agent({
  name: 'Agent',
  instructions: 'あなたはリアルタイム音声機能を備えた親切なアシスタントです。',
  // テキスト生成に使用するモデル; 音声プロバイダーがリアルタイム音声を処理します
  model: openai('gpt-4o'),
  voice: new GeminiLiveVoice({
    apiKey: process.env.GOOGLE_API_KEY,
    model: 'gemini-2.0-flash-exp',
    speaker: 'Puck',
    debug: true,
    // Vertex AI オプション:
    // vertexAI: true,
    // project: 'your-gcp-project',
    // location: 'us-central1',
    // serviceAccountKeyFile: '/path/to/service-account.json',
  }),
});

await agent.voice.connect();

agent.voice.on('speaker', ({ audio }) => {
  playAudio(audio);
});

agent.voice.on('writing', ({ role, text }) => {
  console.log(`${role}: ${text}`);
});

await agent.voice.speak('本日はどのようなご用件でしょうか?');

const micStream = getMicrophoneStream();
await agent.voice.send(micStream);
```

Note:

* Live API には `GOOGLE_API_KEY` が必要です。Vertex AI には project/location とサービス アカウントの認証情報が必要です。
* Events: `speaker`（音声ストリーム）、`writing`（テキスト）、`turnComplete`、`usage`、`error`。
