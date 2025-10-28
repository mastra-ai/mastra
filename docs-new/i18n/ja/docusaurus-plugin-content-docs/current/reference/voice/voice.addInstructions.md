---
title: "リファレンス: voice.addInstructions()"
description: "音声プロバイダーで利用可能な addInstructions() メソッドのドキュメント。音声モデルの動作をガイドするための指示を追加します。"
---

# voice.addInstructions() \{#voiceaddinstructions\}

`addInstructions()` メソッドは、リアルタイムのやり取りにおけるモデルの振る舞いを導く指示をボイスプロバイダーに付与します。これは、会話全体でコンテキストを保持するリアルタイムのボイスプロバイダーに特に有用です。

## 使い方の例 \{#usage-example\}

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

// リアルタイム音声プロバイダーを初期化
const voice = new OpenAIRealtimeVoice({
  realtimeConfig: {
    model: 'gpt-4o-mini-realtime',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// 音声プロバイダーを用いてエージェントを作成
const agent = new Agent({
  name: 'カスタマーサポート担当',
  instructions: 'あなたはソフトウェア企業の有能なカスタマーサポート担当者です。',
  model: openai('gpt-4o'),
  voice,
});

// 音声プロバイダーに追加の指示を設定
voice.addInstructions(`
  お客様と会話する際は、次の点に留意してください:
  - 常にカスタマーサポート担当であることを名乗る
  - 明瞭かつ簡潔に話す
  - 必要に応じて確認の質問をする
  - 会話の最後に要点をまとめる
`);

// リアルタイムサービスに接続
await voice.connect();
```

## パラメータ \{#parameters\}

<br />

<PropertiesTable
  content={[
  {
    name: "instructions",
    type: "string",
    description: "音声モデルの挙動を指示するためのガイダンス",
    isOptional: false,
  },
]}
/>

## 戻り値 \{#return-value\}

このメソッドは値を返しません。

## 注記 \{#notes\}

* 指示は、明確かつ具体的で、音声でのやり取りに関係しているほど効果的です
* このメソッドは、会話コンテキストを保持するリアルタイムの音声プロバイダーで主に使用されます
* 指示に対応していない音声プロバイダーで呼び出された場合は、警告をログに記録し、何も行いません
* このメソッドで追加した指示は、関連する Agent が提供する指示と通常は統合されます
* 最良の結果を得るには、会話を開始する前（`connect()` を呼び出す前）に指示を追加してください
* `addInstructions()` を複数回呼び出すと、プロバイダーの実装によっては既存の指示を置き換える場合と追記する場合があります