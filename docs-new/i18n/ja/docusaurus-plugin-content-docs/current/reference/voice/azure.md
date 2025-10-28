---
title: "リファレンス: Azure Voice"
description: "Azure Cognitive Services を利用してテキスト読み上げと音声認識を提供する AzureVoice クラスのドキュメント。"
---

# Azure \{#azure\}

Mastra の AzureVoice クラスは、Microsoft Azure Cognitive Services を利用して、テキスト読み上げ（Text-to-Speech）と音声認識（Speech-to-Text）の機能を提供します。

## 使い方の例 \{#usage-example\}

```typescript
import { AzureVoice } from '@mastra/voice-azure';

// 設定を使用して初期化
const voice = new AzureVoice({
  speechModel: {
    name: 'neural',
    apiKey: 'your-azure-speech-api-key',
    region: 'eastus',
  },
  listeningModel: {
    name: 'whisper',
    apiKey: 'your-azure-speech-api-key',
    region: 'eastus',
  },
  speaker: 'en-US-JennyNeural', // デフォルトの音声
});

// テキストを音声に変換
const audioStream = await voice.speak('Hello, how can I help you?', {
  speaker: 'en-US-GuyNeural', // デフォルトの音声を上書き
  style: 'cheerful', // 音声スタイル
});

// 音声をテキストに変換
const text = await voice.listen(audioStream, {
  filetype: 'wav',
  language: 'en-US',
});
```

## 設定 \{#configuration\}

### コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "speechModel",
type: "AzureSpeechConfig",
description: "音声合成（テキスト読み上げ）の設定。",
isOptional: true,
},
{
name: "listeningModel",
type: "AzureSpeechConfig",
description: "音声認識（音声→テキスト）の設定。",
isOptional: true,
},
{
name: "speaker",
type: "string",
description: "音声合成のデフォルトのボイス ID。",
isOptional: true,
},
]}
/>

### AzureSpeechConfig \{#azurespeechconfig\}

<PropertiesTable
  content={[
{
name: "name",
type: "'neural' | 'standard' | 'whisper'",
description: "使用するモデルタイプ。TTS には 'neural'、STT には 'whisper' を指定します。",
isOptional: true,
},
{
name: "apiKey",
type: "string",
description:
"Azure Speech Services の API キー。未指定の場合は AZURE_SPEECH_KEY 環境変数が使用されます。",
isOptional: true,
},
{
name: "region",
type: "string",
description:
"Azure のリージョン（例: 'eastus'、'westeurope'）。未指定の場合は AZURE_SPEECH_REGION 環境変数が使用されます。",
isOptional: true,
},
]}
/>

## メソッド \{#methods\}

### speak() \{#speak\}

Azure のニューラル音声合成（Text-to-Speech）サービスを使用して、テキストを音声に変換します。

<PropertiesTable
  content={[
{
name: "input",
type: "string | NodeJS.ReadableStream",
description: "音声に変換するテキストまたはテキストストリーム。",
isOptional: false,
},
{
name: "options.speaker",
type: "string",
description: "音声合成に使用するボイス ID。",
isOptional: true,
defaultValue: "コンストラクターで指定された speaker の値",
},
{
name: "options.style",
type: "string",
description: "話し方のスタイル（例: 'cheerful'、'sad'、'angry'）。",
isOptional: true,
},
{
name: "options.rate",
type: "string",
description: "話速（例: 'slow'、'medium'、'fast'）。",
isOptional: true,
},
{
name: "options.pitch",
type: "string",
description: "声の高さ（例: 'low'、'medium'、'high'）。",
isOptional: true,
},
]}
/>

Returns: `Promise<NodeJS.ReadableStream>`

### listen() \{#listen\}

Azure の音声認識（speech-to-text）サービスを使用して音声を文字起こしします。

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
defaultValue: "'wav'",
},
{
name: "options.language",
type: "string",
description: "文字起こしに使用する言語コード。",
isOptional: true,
defaultValue: "'en-US'",
},
]}
/>

Returns: `Promise<string>`

### getSpeakers() \{#getspeakers\}

利用可能な音声オプションの配列を返します。各要素には以下が含まれます：

<PropertiesTable
  content={[
{
name: "voiceId",
type: "string",
description:
"音声の固有識別子（例: 'en-US-JennyNeural'）",
isOptional: false,
},
{
name: "name",
type: "string",
description: "人間が読みやすい音声名",
isOptional: false,
},
{
name: "locale",
type: "string",
description: "音声の言語ロケール（例: 'en-US'）",
isOptional: false,
},
{
name: "gender",
type: "string",
description: "音声の性別（'Male' または 'Female'）",
isOptional: false,
},
{
name: "styles",
type: "string[]",
description: "その音声で利用可能な話者スタイル",
isOptional: true,
},
]}
/>

## メモ \{#notes\}

* API キーはコンストラクターのオプション、または環境変数（AZURE&#95;SPEECH&#95;KEY、AZURE&#95;SPEECH&#95;REGION）で指定できます
* Azure は多言語にわたり幅広いニューラル音声を提供しています
* 一部の音声は cheerful、sad、angry などの話し方スタイルに対応しています
* 音声認識は複数の音声フォーマットと言語をサポートしています
* Azure の音声サービスは、自然な発話の高品質なニューラル音声を提供します