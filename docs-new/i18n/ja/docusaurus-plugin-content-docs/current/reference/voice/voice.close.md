---
title: "リファレンス: voice.close()"
description: "音声プロバイダーで利用可能な close() メソッドのドキュメント。リアルタイム音声サービスから切断します。"
---

# voice.close() \{#voiceclose\}

`close()` メソッドは、リアルタイム音声サービスから切断し、リソースを解放します。これは、音声セッションを適切に終了し、リソースのリークを防ぐうえで重要です。

## 使い方の例 \{#usage-example\}

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { getMicrophoneStream } from '@mastra/node-audio';

// リアルタイム音声プロバイダーを初期化
const voice = new OpenAIRealtimeVoice({
  realtimeConfig: {
    model: 'gpt-4o-mini-realtime',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// リアルタイムサービスに接続
await voice.connect();

// 会話を開始
voice.speak("こんにちは、私はあなたのAIアシスタントです!");

// マイクから音声をストリーミング
const microphoneStream = getMicrophoneStream();
voice.send(microphoneStream);

// 会話が完了したとき
setTimeout(() => {
  // 接続を閉じてリソースをクリーンアップ
  voice.close();
  console.log('音声セッションが終了しました');
}, 60000); // 1分後に終了
```

## パラメータ \{#parameters\}

このメソッドはパラメータを受け取りません。

## 戻り値 \{#return-value\}

このメソッドは値を返しません。

## 注意事項 \{#notes\}

* リアルタイム音声セッションが終わったら、リソースを解放するために必ず `close()` を呼び出してください
* `close()` を呼び出した後に新しいセッションを開始する場合は、再度 `connect()` を呼び出す必要があります
* このメソッドは、永続接続を維持するリアルタイム音声プロバイダーと併用されることが主です
* リアルタイム接続をサポートしていない音声プロバイダーで呼び出した場合は、警告をログ出力し、何も行いません
* 接続を閉じないと、リソースのリークや音声サービスプロバイダーにおける課金上の問題につながる可能性があります