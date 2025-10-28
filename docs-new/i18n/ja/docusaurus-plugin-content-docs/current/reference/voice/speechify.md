---
title: "リファレンス: Speechify Voice"
description: "Speechify Voice 実装のドキュメント。テキスト読み上げ機能を提供します。"
---

# Speechify \{#speechify\}

Mastra の Speechify 音声実装は、Speechify の API を利用してテキスト読み上げ機能（テキスト・トゥ・スピーチ）を提供します。

## 使い方の例 \{#usage-example\}

```typescript
import { SpeechifyVoice } from '@mastra/voice-speechify';

// デフォルト設定で初期化(SPEECHIFY_API_KEY環境変数を使用)
const voice = new SpeechifyVoice();

// カスタム設定で初期化
const voice = new SpeechifyVoice({
  speechModel: {
    name: 'simba-english',
    apiKey: 'your-api-key',
  },
  speaker: 'george', // デフォルトの音声
});

// テキストを音声に変換
const audioStream = await voice.speak('Hello, world!', {
  speaker: 'henry', // デフォルトの音声をオーバーライド
});
```

## コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "speechModel",
type: "SpeechifyConfig",
description: "テキスト読み上げ（TTS）機能の設定",
isOptional: true,
defaultValue: "{ name: 'simba-english' }",
},
{
name: "speaker",
type: "SpeechifyVoiceId",
description: "音声合成で使用する既定のボイスID",
isOptional: true,
defaultValue: "'george'",
},
]}
/>

### SpeechifyConfig \{#speechifyconfig\}

<PropertiesTable
  content={[
{
name: "name",
type: "VoiceModelName",
description: "使用する Speechify のモデル",
isOptional: true,
defaultValue: "'simba-english'",
},
{
name: "apiKey",
type: "string",
description:
"Speechify の API キー。未指定の場合は環境変数 SPEECHIFY_API_KEY が使用されます",
isOptional: true,
},
]}
/>

## メソッド \{#methods\}

### speak() \{#speak\}

設定済みの音声モデルとボイスでテキストを音声に変換します。

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
name: "options.speaker",
type: "string",
description: "このリクエストに対してデフォルトの話者を上書きします",
isOptional: true,
defaultValue: "コンストラクタの speaker の値",
},
{
name: "options.model",
type: "VoiceModelName",
description: "このリクエストに対してデフォルトのモデルを上書きします",
isOptional: true,
defaultValue: "コンストラクタの model の値",
},
]}
/>

戻り値: `Promise<NodeJS.ReadableStream>`

### getSpeakers() \{#getspeakers\}

利用可能な音声オプションの配列を返します。各項目には次が含まれます：

<PropertiesTable
  content={[
{
name: "voiceId",
type: "string",
description: "音声の固有識別子",
},
{
name: "name",
type: "string",
description: "音声の表示名",
},
{
name: "language",
type: "string",
description: "音声の言語コード",
},
{
name: "gender",
type: "string",
description: "音声の性別",
},
]}
/>

### listen() \{#listen\}

このメソッドは Speechify ではサポートされていないため、呼び出すとエラーをスローします。Speechify は音声認識（speech-to-text）機能を提供していません。

## 注意事項 \{#notes\}

* Speechify の認証には API キーが必要です
* 既定のモデルは &#39;simba-english&#39; です
* 音声認識（speech-to-text）機能はサポートしていません
* 追加のオーディオストリームのオプションは、speak() メソッドの options パラメータで指定できます