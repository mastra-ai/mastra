---
title: "リファレンス: Google Voice"
description: "Google Voice 実装のドキュメント。テキスト読み上げ（text-to-speech）と音声認識（speech-to-text）機能を提供します。"
---

# Google \{#google\}

Mastra における Google Voice の実装は、Google Cloud サービスを利用して、text-to-speech (TTS) と speech-to-text (STT) の両機能を提供します。複数の音声と言語に対応し、高度なオーディオ設定オプションもサポートしています。

## 使い方の例 \{#usage-example\}

```typescript
import { GoogleVoice } from '@mastra/voice-google';

// デフォルト設定で初期化（GOOGLE_API_KEY環境変数を使用）
const voice = new GoogleVoice();

// カスタム設定で初期化
const voice = new GoogleVoice({
  speechModel: {
    apiKey: 'your-speech-api-key',
  },
  listeningModel: {
    apiKey: 'your-listening-api-key',
  },
  speaker: 'en-US-Casual-K',
});

// テキスト読み上げ
const audioStream = await voice.speak('Hello, world!', {
  languageCode: 'en-US',
  audioConfig: {
    audioEncoding: 'LINEAR16',
  },
});

// 音声認識
const transcript = await voice.listen(audioStream, {
  config: {
    encoding: 'LINEAR16',
    languageCode: 'en-US',
  },
});

// 特定の言語で利用可能な音声を取得
const voices = await voice.getSpeakers({ languageCode: 'en-US' });
```

## コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "speechModel",
type: "GoogleModelConfig",
description: "テキスト読み上げ（TTS）機能の設定",
isOptional: true,
defaultValue: "{ apiKey: process.env.GOOGLE_API_KEY }",
},
{
name: "listeningModel",
type: "GoogleModelConfig",
description: "音声認識（STT）機能の設定",
isOptional: true,
defaultValue: "{ apiKey: process.env.GOOGLE_API_KEY }",
},
{
name: "speaker",
type: "string",
description: "テキスト読み上げで使用する既定のボイス ID",
isOptional: true,
defaultValue: "'en-US-Casual-K'",
},
]}
/>

### GoogleModelConfig \{#googlemodelconfig\}

<PropertiesTable
  content={[
{
name: "apiKey",
type: "string",
description:
"Google Cloud の API キー。未指定の場合は GOOGLE_API_KEY 環境変数が使用されます",
isOptional: true,
},
]}
/>

## 方法 \{#methods\}

### speak() \{#speak\}

Google Cloud Text-to-Speech サービスを使用してテキストを音声に変換します。

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
description: "音声合成のオプション",
isOptional: true,
},
{
name: "options.speaker",
type: "string",
description: "このリクエストで使用するボイス ID",
isOptional: true,
},
{
name: "options.languageCode",
type: "string",
description:
"音声の言語コード（例: 'en-US'）。既定値はボイス ID の言語コード、または 'en-US' です。",
isOptional: true,
},
{
name: "options.audioConfig",
type: "ISynthesizeSpeechRequest['audioConfig']",
description:
"Google Cloud Text-to-Speech API の音声設定オプション",
isOptional: true,
defaultValue: "{ audioEncoding: 'LINEAR16' }",
},
]}
/>

戻り値: `Promise<NodeJS.ReadableStream>`

### listen() \{#listen\}

Google Cloud Speech-to-Text を使用して音声をテキストに変換します。

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
description: "認識オプション",
isOptional: true,
},
{
name: "options.stream",
type: "boolean",
description: "ストリーミング認識を使用するかどうか",
isOptional: true,
},
{
name: "options.config",
type: "IRecognitionConfig",
description:
"Google Cloud Speech-to-Text API の認識設定",
isOptional: true,
defaultValue: "{ encoding: 'LINEAR16', languageCode: 'en-US' }",
},
]}
/>

戻り値: `Promise<string>`

### getSpeakers() \{#getspeakers\}

利用可能な音声オプションの配列を返します。各エントリには以下が含まれます:

<PropertiesTable
  content={[
{
name: "voiceId",
type: "string",
description: "音声の固有識別子",
isOptional: false,
},
{
name: "languageCodes",
type: "string[]",
description: "この音声が対応する言語コードの一覧",
isOptional: false,
},
]}
/>

## 重要な注意事項 \{#important-notes\}

1. Google Cloud の API キーが必要です。`GOOGLE_API_KEY` 環境変数で設定するか、コンストラクターに渡してください。
2. 既定のボイスは &#39;en-US-Casual-K&#39; に設定されています。
3. Text-to-Speech と Speech-to-Text の両サービスは、既定の音声エンコーディングとして LINEAR16 を使用します。
4. `speak()` メソッドは、Google Cloud Text-to-Speech API を介した高度な音声設定をサポートします。
5. `listen()` メソッドは、Google Cloud Speech-to-Text API を介した各種認識設定をサポートします。
6. 利用可能なボイスは、`getSpeakers()` メソッドで言語コードによるフィルタリングが可能です。