---
title: "リファレンス: voice.updateConfig()"
description: "音声プロバイダーの設定を実行時に更新するために、各音声プロバイダーで利用できる updateConfig() メソッドのドキュメント。"
---

# voice.updateConfig() \{#voiceupdateconfig\}

`updateConfig()` メソッドは、実行時に音声プロバイダーの設定を更新できます。新しいインスタンスを作成せずに、音声設定や API キー、その他のプロバイダー固有のオプションを変更するのに便利です。

## 使い方の例 \{#usage-example\}

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';

// リアルタイム音声プロバイダーを初期化
const voice = new OpenAIRealtimeVoice({
  realtimeConfig: {
    model: 'gpt-4o-mini-realtime',
    apiKey: process.env.OPENAI_API_KEY,
  },
  speaker: 'alloy',
});

// リアルタイムサービスに接続
await voice.connect();

// 後で設定を更新
voice.updateConfig({
  voice: 'nova', // デフォルトの音声を変更
  turn_detection: {
    type: 'server_vad',
    threshold: 0.5,
    silence_duration_ms: 1000,
  },
});

// 次のspeak()呼び出しで新しい設定が使用されます
await voice.speak('新しい音声でこんにちは!');
```

## パラメータ \{#parameters\}

<br />

<PropertiesTable
  content={[
  {
    name: "options",
    type: "Record<string, unknown>",
    description:
      "更新する設定オプション。具体的なプロパティは、音声プロバイダーによって異なります。",
    isOptional: false,
  },
]}
/>

## 戻り値 \{#return-value\}

このメソッドは値を返しません。

## 設定オプション \{#configuration-options\}

音声プロバイダーによって、利用できる設定オプションは異なります。

### OpenAI Realtime \{#openai-realtime\}

<br />

<PropertiesTable
  content={[
  {
    name: "voice",
    type: "string",
    description:
      "音声合成に使用する音声ID（例：'alloy'、'echo'、'nova'）",
    isOptional: true,
  },
  {
    name: "turn_detection",
    type: "{ type: string, threshold?: number, silence_duration_ms?: number }",
    description:
      "ユーザーが発話を終えたことを検出するための設定",
    isOptional: true,
  },
]}
/>

## 注意 \{#notes\}

* デフォルトの実装では、プロバイダーがこのメソッドをサポートしていない場合に警告が記録されます
* 設定の更新は通常、進行中の処理ではなく、以降の処理に適用されます
* コンストラクターで設定可能なすべてのプロパティが、実行時に更新できるとは限りません
* 具体的な挙動は、音声プロバイダーの実装に依存します
* リアルタイムの音声プロバイダーでは、設定変更の反映にサービスへの再接続が必要となる場合があります