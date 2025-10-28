---
title: "リファレンス: Deepgram Voice"
description: "Deepgram の音声機能実装に関するドキュメント。複数の音声モデルと言語をサポートし、テキスト読み上げと音声認識の機能を提供します。"
---

# Deepgram \{#deepgram\}

Mastra における Deepgram の音声機能実装は、Deepgram の API を用いて text-to-speech（TTS）と speech-to-text（STT）を提供します。音声合成と文字起こしの双方で設定可能なオプションを備え、複数の音声モデルと言語に対応しています。

## 使い方の例 \{#usage-example\}

```typescript
import { DeepgramVoice } from '@mastra/voice-deepgram';

// デフォルト設定で初期化（DEEPGRAM_API_KEY環境変数を使用）
const voice = new DeepgramVoice();

// カスタム設定で初期化
const voice = new DeepgramVoice({
  speechModel: {
    name: 'aura',
    apiKey: 'your-api-key',
  },
  listeningModel: {
    name: 'nova-2',
    apiKey: 'your-api-key',
  },
  speaker: 'asteria-en',
});

// テキスト読み上げ
const audioStream = await voice.speak('こんにちは、世界！');

// 音声認識
const transcript = await voice.listen(audioStream);
```

## コンストラクターのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "speechModel",
type: "DeepgramVoiceConfig",
description: "テキスト読み上げ（TTS）の設定。",
isOptional: true,
defaultValue: "{ name: 'aura' }",
},
{
name: "listeningModel",
type: "DeepgramVoiceConfig",
description: "音声認識（STT）の設定。",
isOptional: true,
defaultValue: "{ name: 'nova' }",
},
{
name: "speaker",
type: "DeepgramVoiceId",
description: "テキスト読み上げで使用する既定の音声。",
isOptional: true,
defaultValue: "'asteria-en'",
},
]}
/>

### DeepgramVoiceConfig \{#deepgramvoiceconfig\}

<PropertiesTable
  content={[
{
name: "name",
type: "DeepgramModel",
description: "使用する Deepgram モデル",
isOptional: true,
},
{
name: "apiKey",
type: "string",
description:
"Deepgram の API キー。未指定の場合は環境変数 DEEPGRAM_API_KEY が使用されます",
isOptional: true,
},
{
name: "properties",
type: "Record<string, any>",
description: "Deepgram API に渡す追加プロパティ",
isOptional: true,
},
{
name: "language",
type: "string",
description: "モデルの言語コード",
isOptional: true,
},
]}
/>

## 手法 \{#methods\}

### speak() \{#speak\}

設定済みの音声モデルとボイスを用いて、テキストを音声に変換します。

<PropertiesTable
  content={[
{
name: "input",
type: "string | NodeJS.ReadableStream",
description:
"音声に変換するテキスト。ストリームが渡された場合は、先にテキストへ変換されます。",
isOptional: false,
},
{
name: "options",
type: "object",
description: "音声合成の追加オプション",
isOptional: true,
},
{
name: "options.speaker",
type: "string",
description: "このリクエストで既定のスピーカーを上書きします",
isOptional: true,
},
]}
/>

Returns: `Promise<NodeJS.ReadableStream>`

### listen() \{#listen\}

設定済みのリッスンモデルを使用して、音声をテキストに変換します。

<PropertiesTable
  content={[
{
name: "audioStream",
type: "NodeJS.ReadableStream",
description: "文字起こし対象の音声ストリーム",
isOptional: false,
},
{
name: "options",
type: "object",
description: "Deepgram API に渡す追加のオプション",
isOptional: true,
},
]}
/>

戻り値: `Promise<string>`

### getSpeakers() \{#getspeakers\}

利用可能な音声オプションの一覧を返します。

<PropertiesTable
  content={[
{
name: "voiceId",
type: "string",
description: "音声の一意の識別子",
isOptional: false,
},
]}
/>