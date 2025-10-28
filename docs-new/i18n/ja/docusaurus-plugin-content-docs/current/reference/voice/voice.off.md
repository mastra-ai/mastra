---
title: "リファレンス: voice.off()"
description: "voice プロバイダーで利用可能な off() メソッドのドキュメント。voice の各種イベントに登録されたリスナーを解除します。"
---

# voice.off() \{#voiceoff\}

`off()` メソッドは、`on()` メソッドで登録したイベントリスナーを解除します。これは、リアルタイム音声機能を備えた長時間稼働のアプリケーションにおいて、リソースを解放し、メモリリークを防ぐために特に有用です。

## 使い方の例 \{#usage-example\}

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import chalk from 'chalk';

// リアルタイム音声プロバイダーを初期化
const voice = new OpenAIRealtimeVoice({
  realtimeConfig: {
    model: 'gpt-4o-mini-realtime',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// リアルタイムサービスに接続
await voice.connect();

// コールバック関数を定義
const writingCallback = ({ text, role }) => {
  if (role === 'user') {
    process.stdout.write(chalk.green(text));
  } else {
    process.stdout.write(chalk.blue(text));
  }
};

// イベントリスナーを登録
voice.on('writing', writingCallback);

// 後でリスナーを削除する場合
voice.off('writing', writingCallback);
```

## パラメータ \{#parameters\}

<br />

<PropertiesTable
  content={[
  {
    name: "event",
    type: "string",
    description:
      "監視を停止するイベント名（例：'speaking'、'writing'、'error'）",
    isOptional: false,
  },
  {
    name: "callback",
    type: "function",
    description: "on() に渡したのと同じコールバック関数",
    isOptional: false,
  },
]}
/>

## 戻り値 \{#return-value\}

このメソッドは値を返しません。

## 注意事項 \{#notes\}

* `off()` に渡すコールバックは、`on()` に渡したものと同一の関数参照である必要があります
* コールバックが見つからない場合、このメソッドは何の効果もありません
* このメソッドは、イベント駆動の通信をサポートするリアルタイム音声プロバイダーで主に使用されます
* イベントをサポートしていない音声プロバイダーで呼び出した場合は、警告を出力して何もしません
* 長時間稼働するアプリケーションでのメモリリーク防止には、イベントリスナーの削除が重要です