---
title: "リファレンス: voice.answer()"
description: "リアルタイム音声プロバイダーで利用可能な answer() メソッドのドキュメント。音声プロバイダーに応答の生成を指示します。"
---

# voice.answer() \{#voiceanswer\}

`answer()` メソッドは、リアルタイム音声プロバイダーで AI に応答生成を指示するために使用します。特に、ユーザー入力を受け取った後に AI に明示的な応答指示が必要となる音声対話で有用です。

## 使い方の例 \{#usage-example\}

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { getMicrophoneStream } from '@mastra/node-audio';
import Speaker from '@mastra/node-speaker';

const speaker = new Speaker({
  sampleRate: 24100, // オーディオのサンプリングレート（Hz）— MacBook Proでの高音質の標準
  channels: 1, // モノラル出力（ステレオなら2）
  bitDepth: 16, // 音質のためのビット深度 — CD品質の標準（16ビット）
});

// リアルタイム音声プロバイダーを初期化
const voice = new OpenAIRealtimeVoice({
  realtimeConfig: {
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  },
  speaker: 'alloy', // 既定の音声
});
// リアルタイムサービスに接続
await voice.connect();
// 応答用のイベントリスナーを登録
voice.on('speaker', stream => {
  // 音声応答を処理
  stream.pipe(speaker);
});
// ユーザーの音声入力を送信
const microphoneStream = getMicrophoneStream();
await voice.send(microphoneStream);
// AIの応答をトリガー
await voice.answer();
```

## パラメータ \{#parameters\}

<br />

<PropertiesTable
  content={[
  {
    name: "options",
    type: "Record<string, unknown>",
    description: "プロバイダー固有のレスポンス用オプション",
    isOptional: true,
  },
]}
/>

## 戻り値 \{#return-value\}

レスポンスが発生した時点で解決される `Promise<void>` を返します。

## 注意 \{#notes\}

* このメソッドは、音声同士の変換（speech-to-speech）に対応したリアルタイム音声プロバイダーでのみ実装されています
* この機能に非対応の音声プロバイダーで呼び出された場合は、警告をログ出力し、即座に処理を完了します
* 応答音声は、直接返されるのではなく、通常は「speaking」イベント経由で出力されます
* 対応プロバイダーでは、AIに生成させるのではなく、特定の応答をこのメソッドで送信できます
* このメソッドは、会話の流れを構築するために `send()` と併用されるのが一般的です