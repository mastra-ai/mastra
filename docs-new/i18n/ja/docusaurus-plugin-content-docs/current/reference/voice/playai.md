---
title: "リファレンス: PlayAI Voice"
description: "PlayAI Voice 実装のドキュメント。テキスト読み上げ（音声合成）機能を提供します。"
---

# PlayAI \{#playai\}

Mastra の PlayAI 音声実装は、PlayAI の API を用いてテキスト読み上げ（テキスト音声合成）機能を提供します。

## 使い方の例 \{#usage-example\}

```typescript
import { PlayAIVoice } from '@mastra/voice-playai';

// デフォルト設定で初期化(PLAYAI_API_KEY環境変数とPLAYAI_USER_ID環境変数を使用)
const voice = new PlayAIVoice();

// デフォルト設定で初期化
const voice = new PlayAIVoice({
  speechModel: {
    name: 'PlayDialog',
    apiKey: process.env.PLAYAI_API_KEY,
    userId: process.env.PLAYAI_USER_ID,
  },
  speaker: 'Angelo', // デフォルトの音声
});

// 特定の音声でテキストを音声に変換
const audioStream = await voice.speak('Hello, world!', {
  speaker: 's3://voice-cloning-zero-shot/b27bc13e-996f-4841-b584-4d35801aea98/original/manifest.json', // Dexter音声
});
```

## コンストラクターのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "speechModel",
type: "PlayAIConfig",
description: "テキスト読み上げ機能の設定",
isOptional: true,
defaultValue: "{ name: 'PlayDialog' }",
},
{
name: "speaker",
type: "string",
description: "音声合成で使用する既定のボイス ID",
isOptional: true,
defaultValue: "最初に利用可能なボイス ID",
},
]}
/>

### PlayAIConfig \{#playaiconfig\}

<PropertiesTable
  content={[
{
name: "name",
type: "'PlayDialog' | 'Play3.0-mini'",
description: "使用する PlayAI のモデル",
isOptional: true,
defaultValue: "'PlayDialog'",
},
{
name: "apiKey",
type: "string",
description:
"PlayAI の API キー。未設定の場合は環境変数 PLAYAI_API_KEY が使用されます",
isOptional: true,
},
{
name: "userId",
type: "string",
description:
"PlayAI のユーザー ID。未設定の場合は環境変数 PLAYAI_USER_ID が使用されます",
isOptional: true,
},
]}
/>

## メソッド \{#methods\}

### speak() \{#speak\}

設定済みの音声モデルとボイスを使って、テキストを音声に変換します。

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
description: "このリクエストでデフォルトのスピーカーを上書きします",
isOptional: true,
defaultValue: "コンストラクタの speaker 値",
},
]}
/>

戻り値: `Promise<NodeJS.ReadableStream>`。

### getSpeakers() \{#getspeakers\}

利用可能な音声オプションの配列を返します。各要素には以下が含まれます:

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "音声名",
isOptional: false,
},
{
name: "accent",
type: "string",
description: "アクセント（例:「US」「British」「Australian」）",
isOptional: false,
},
{
name: "gender",
type: "'M' | 'F'",
description: "性別",
isOptional: false,
},
{
name: "age",
type: "'Young' | 'Middle' | 'Old'",
description: "年齢カテゴリ",
isOptional: false,
},
{
name: "style",
type: "'Conversational' | 'Narrative'",
description: "話法スタイル",
isOptional: false,
},
{
name: "voiceId",
type: "string",
description: "音声の一意識別子",
isOptional: false,
},
]}
/>

### listen() \{#listen\}

このメソッドは PlayAI ではサポートされておらず、実行するとエラーになります。なお、PlayAI は音声認識（speech-to-text）機能を提供していません。

## 注意事項 \{#notes\}

* PlayAI の認証には、API キーとユーザー ID の両方が必要です
* サービスでは「PlayDialog」と「Play3.0-mini」の2つのモデルを提供しています
* 各音声には固有の S3 マニフェスト ID があり、API 呼び出し時に指定する必要があります