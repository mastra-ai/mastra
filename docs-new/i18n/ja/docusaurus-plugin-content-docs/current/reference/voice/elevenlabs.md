---
title: "リファレンス: ElevenLabs Voice"
description: "ElevenLabs の音声実装に関するドキュメント。複数の音声モデルによる高品質なテキスト読み上げと、自然な音声合成を提供します。"
---

# ElevenLabs \{#elevenlabs\}

Mastra における ElevenLabs の音声機能実装は、ElevenLabs API を利用して、高品質なテキスト読み上げ（TTS）と音声認識（STT）を提供します。

## 使い方の例 \{#usage-example\}

```typescript
import { ElevenLabsVoice } from '@mastra/voice-elevenlabs';

// デフォルト設定で初期化（ELEVENLABS_API_KEY 環境変数を使用）
const voice = new ElevenLabsVoice();

// カスタム設定で初期化
const voice = new ElevenLabsVoice({
  speechModel: {
    name: 'eleven_multilingual_v2',
    apiKey: 'your-api-key',
  },
  speaker: 'custom-speaker-id',
});

// テキスト読み上げ
const audioStream = await voice.speak('Hello, world!');

// 利用可能な話者を取得
const speakers = await voice.getSpeakers();
```

## コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "speechModel",
type: "ElevenLabsVoiceConfig",
description: "テキスト読み上げ機能の設定。",
isOptional: true,
defaultValue: "{ name: 'eleven_multilingual_v2' }",
},
{
name: "speaker",
type: "string",
description: "テキスト読み上げに使用する話者のID。",
isOptional: true,
defaultValue: "'9BWtsMINqrJLrRacOk9x'（Aria 音声）",
},
]}
/>

### ElevenLabsVoiceConfig \{#elevenlabsvoiceconfig\}

<PropertiesTable
  content={[
{
name: "name",
type: "ElevenLabsModel",
description: "使用する ElevenLabs のモデル",
isOptional: true,
defaultValue: "'eleven_multilingual_v2'",
},
{
name: "apiKey",
type: "string",
description:
"ElevenLabs の API キー。未指定の場合は環境変数 ELEVENLABS_API_KEY が使用されます",
isOptional: true,
},
]}
/>

## 手法 \{#methods\}

### speak() \{#speak\}

設定済みの音声モデルとボイスを使用して、テキストを音声に変換します。

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
description: "このリクエストでデフォルトのスピーカーIDを上書きします",
isOptional: true,
},
]}
/>

Returns: `Promise<NodeJS.ReadableStream>`

### getSpeakers() \{#getspeakers\}

利用可能な音声オプションの配列を返します。各ノードには次の情報が含まれます：

<PropertiesTable
  content={[
{
name: "voiceId",
type: "string",
description: "音声のユニークな識別子",
isOptional: false,
},
{
name: "name",
type: "string",
description: "音声の表示名",
isOptional: false,
},
{
name: "language",
type: "string",
description: "音声の言語コード",
isOptional: false,
},
{
name: "gender",
type: "string",
description: "音声の性別",
isOptional: false,
},
]}
/>

### listen() \{#listen\}

ElevenLabs Speech-to-Text API を使用して、音声入力をテキストに変換します。

<PropertiesTable
  content={[
{
name: "input",
type: "NodeJS.ReadableStream",
description: "文字起こしする音声データを含む読み取り可能なストリーム",
isOptional: false,
},
{
name: "options",
type: "object",
description: "文字起こしの設定オプション",
isOptional: true,
},
]}
/>

options オブジェクトでは、以下のプロパティを使用できます:

<PropertiesTable
  content={[
{
name: "language_code",
type: "string",
description: "ISO 言語コード（例: 'en'、'fr'、'es'）",
isOptional: true,
},
{
name: "tag_audio_events",
type: "boolean",
description: "[MUSIC]、[LAUGHTER] などの音声イベントにタグを付与するかどうか",
isOptional: true,
},
{
name: "num_speakers",
type: "number",
description: "音声内で検出する話者数",
isOptional: true,
},
{
name: "filetype",
type: "string",
description: "音声ファイル形式（例: 'mp3'、'wav'、'ogg'）",
isOptional: true,
},
{
name: "timeoutInSeconds",
type: "number",
description: "リクエストのタイムアウト（秒）",
isOptional: true,
},
{
name: "maxRetries",
type: "number",
description: "最大再試行回数",
isOptional: true,
},
{
name: "abortSignal",
type: "AbortSignal",
description: "リクエストを中止するためのシグナル",
isOptional: true,
},
]}
/>

戻り値: `Promise<string>` - 文字起こしされたテキストを解決する Promise

## 重要な注意事項 \{#important-notes\}

1. ElevenLabs の API キーが必要です。`ELEVENLABS_API_KEY` 環境変数で設定するか、コンストラクタに渡してください。
2. デフォルトの話者は Aria（ID: &#39;9BWtsMINqrJLrRacOk9x&#39;）です。
3. ElevenLabs は音声認識（Speech-to-Text）機能をサポートしていません。
4. 利用可能な話者は `getSpeakers()` メソッドで取得できます。各ボイスの言語や性別などの詳細情報が返されます。