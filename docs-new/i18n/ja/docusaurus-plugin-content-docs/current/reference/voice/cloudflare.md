---
title: "リファレンス: Cloudflare Voice"
description: "Cloudflare Workers AI を使用してテキスト読み上げ機能を提供する CloudflareVoice クラスのドキュメント。"
---

# Cloudflare \{#cloudflare\}

Mastra の CloudflareVoice クラスは、Cloudflare Workers AI を用いてテキスト読み上げ（TTS）機能を提供します。このプロバイダーは、エッジコンピューティング環境に最適化された、高効率・低レイテンシの音声合成に特化しています。

## 使用例 \{#usage-example\}

```typescript
import { CloudflareVoice } from '@mastra/voice-cloudflare';

// 設定で初期化
const voice = new CloudflareVoice({
  speechModel: {
    name: '@cf/meta/m2m100-1.2b',
    apiKey: 'your-cloudflare-api-token',
    accountId: 'your-cloudflare-account-id',
  },
  speaker: 'en-US-1', // デフォルトの音声
});

// テキストを音声に変換
const audioStream = await voice.speak('Hello, how can I help you?', {
  speaker: 'en-US-2', // デフォルトの音声を上書き
});

// 利用可能な音声を取得
const speakers = await voice.getSpeakers();
console.log(speakers);
```

## 構成 \{#configuration\}

### コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "speechModel",
type: "CloudflareSpeechConfig",
description: "音声合成（テキスト読み上げ）の設定。",
isOptional: true,
},
{
name: "speaker",
type: "string",
description: "音声合成のデフォルト音声ID。",
isOptional: true,
defaultValue: "'en-US-1'",
},
]}
/>

### CloudflareSpeechConfig \{#cloudflarespeechconfig\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "TTS に使用するモデル名。",
isOptional: true,
defaultValue: "'@cf/meta/m2m100-1.2b'",
},
{
name: "apiKey",
type: "string",
description:
"Workers AI へのアクセス権を持つ Cloudflare API トークン。未指定の場合は CLOUDFLARE_API_TOKEN 環境変数が使用されます。",
isOptional: true,
},
{
name: "accountId",
type: "string",
description:
"Cloudflare アカウント ID。未指定の場合は CLOUDFLARE_ACCOUNT_ID 環境変数が使用されます。",
isOptional: true,
},
]}
/>

## メソッド \{#methods\}

### speak() \{#speak\}

Cloudflare のテキスト読み上げサービスを使って、テキストを音声に変換します。

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
type: "string",
description: "音声合成に使用するボイス ID。",
isOptional: true,
defaultValue: "コンストラクターで指定された speaker の値",
},
{
name: "options.format",
type: "string",
description: "出力音声の形式。",
isOptional: true,
defaultValue: "'mp3'",
},
]}
/>

Returns: `Promise<NodeJS.ReadableStream>`

### getSpeakers() \{#getspeakers\}

利用可能な音声オプションの配列を返します。各要素には次が含まれます：

<PropertiesTable
  content={[
{
name: "voiceId",
type: "string",
description: "音声の固有識別子（例：'en-US-1'）",
isOptional: false,
},
{
name: "language",
type: "string",
description: "音声の言語コード（例：'en-US'）",
isOptional: false,
},
]}
/>

## 注意事項 \{#notes\}

* API トークンはコンストラクタのオプション、または環境変数（CLOUDFLARE&#95;API&#95;TOKEN と CLOUDFLARE&#95;ACCOUNT&#95;ID）で指定できます
* Cloudflare Workers AI は低レイテンシーなエッジコンピューティング向けに最適化されています
* このプロバイダーは音声合成（TTS）のみをサポートし、音声認識（STT）には対応していません
* このサービスは他の Cloudflare Workers 製品とシームレスに連携します
* 本番環境で利用する際は、Cloudflare アカウントで適切な Workers AI サブスクリプションに加入していることを確認してください
* 音声の選択肢は一部の他プロバイダーと比べて限られますが、エッジでのパフォーマンスは優れています

## 関連プロバイダー \{#related-providers\}

テキスト読み上げに加えて音声認識（speech-to-text）機能が必要な場合は、次のプロバイダーの利用を検討してください。

* [OpenAI](./openai) - TTS と STT の両方に対応
* [Google](./google) - TTS と STT の両方に対応
* [Azure](./azure) - TTS と STT の両方に対応