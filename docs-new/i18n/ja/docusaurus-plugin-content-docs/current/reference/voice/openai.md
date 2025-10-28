---
title: "リファレンス: OpenAI Voice"
description: "OpenAIVoice クラスのリファレンス。テキスト読み上げ（text-to-speech）と音声文字起こし（speech-to-text）の機能について解説します。"
---

# OpenAI \{#openai\}

Mastra の OpenAIVoice クラスは、OpenAI のモデルを用いてテキスト読み上げ（text-to-speech）および音声認識（speech-to-text）機能を提供します。

## 使い方の例 \{#usage-example\}

```typescript
import { OpenAIVoice } from '@mastra/voice-openai';

// 環境変数を使用してデフォルト設定で初期化
const voice = new OpenAIVoice();

// または特定の設定で初期化
const voiceWithConfig = new OpenAIVoice({
  speechModel: {
    name: 'tts-1-hd',
    apiKey: 'your-openai-api-key',
  },
  listeningModel: {
    name: 'whisper-1',
    apiKey: 'your-openai-api-key',
  },
  speaker: 'alloy', // デフォルトの音声
});

// テキストを音声に変換
const audioStream = await voice.speak('Hello, how can I help you?', {
  speaker: 'nova', // デフォルトの音声を上書き
  speed: 1.2, // 音声速度を調整
});

// 音声をテキストに変換
const text = await voice.listen(audioStream, {
  filetype: 'mp3',
});
```

## 設定 \{#configuration\}

### コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "speechModel",
type: "OpenAIConfig",
description: "テキスト読み上げ（音声合成）の設定。",
isOptional: true,
defaultValue: "{ name: 'tts-1' }",
},
{
name: "listeningModel",
type: "OpenAIConfig",
description: "音声認識（音声→テキスト）の設定。",
isOptional: true,
defaultValue: "{ name: 'whisper-1' }",
},
{
name: "speaker",
type: "OpenAIVoiceId",
description: "音声合成のデフォルトのボイス ID。",
isOptional: true,
defaultValue: "'alloy'",
},
]}
/>

### OpenAIConfig \{#openaiconfig\}

<PropertiesTable
  content={[
{
name: "name",
type: "'tts-1' | 'tts-1-hd' | 'whisper-1'",
description: "モデル名。より高品質な音声には「tts-1-hd」を使用してください。",
isOptional: true,
},
{
name: "apiKey",
type: "string",
description:
"OpenAI APIキー。未設定の場合は環境変数 OPENAI_API_KEY が使用されます。",
isOptional: true,
},
]}
/>

## メソッド \{#methods\}

### speak() \{#speak\}

OpenAI のテキスト読み上げ（text-to-speech）モデルを使って、テキストを音声に変換します。

<PropertiesTable
  content={[
{
name: "input",
type: "string | NodeJS.ReadableStream",
description: "音声に変換するテキストまたはテキストのストリーム。",
isOptional: false,
},
{
name: "options.speaker",
type: "OpenAIVoiceId",
description: "音声合成に使用するボイス ID。",
isOptional: true,
defaultValue: "コンストラクターの speaker の値",
},
{
name: "options.speed",
type: "number",
description: "再生速度の倍率。",
isOptional: true,
defaultValue: "1.0",
},
]}
/>

Returns: `Promise<NodeJS.ReadableStream>`

### listen() \{#listen\}

OpenAI の Whisper モデルを使用して音声を文字起こしします。

<PropertiesTable
  content={[
{
name: "audioStream",
type: "NodeJS.ReadableStream",
description: "文字起こしする音声ストリーム。",
isOptional: false,
},
{
name: "options.filetype",
type: "string",
description: "入力ストリームの音声形式。",
isOptional: true,
defaultValue: "'mp3'",
},
]}
/>

戻り値: `Promise<string>`

### getSpeakers() \{#getspeakers\}

利用可能な音声オプションの配列を返します。各項目には以下が含まれます：

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

## 注意事項 \{#notes\}

* API キーはコンストラクタのオプション、または `OPENAI_API_KEY` 環境変数で指定できます
* `tts-1-hd` モデルはより高品質な音声を生成しますが、処理に時間がかかる場合があります
* 音声認識は mp3、wav、webm など複数の音声形式に対応しています