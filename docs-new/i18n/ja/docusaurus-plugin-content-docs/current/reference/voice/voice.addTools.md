---
title: "リファレンス: voice.addTools()"
description: "音声プロバイダーで利用可能な addTools() メソッドのドキュメント。音声モデルに関数呼び出し機能を付与します。"
---

# voice.addTools() \{#voiceaddtools\}

`addTools()` メソッドは、モデルがリアルタイムの対話中に呼び出せるツール（関数）を音声プロバイダーに追加します。これにより、音声アシスタントは情報の検索、計算の実行、外部システムとの連携などの処理を行えるようになります。

## 使い方の例 \{#usage-example\}

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// ツールを定義
const weatherTool = createTool({
  id: 'getWeather',
  description: '指定された場所の現在の天気を取得',
  inputSchema: z.object({
    location: z.string().describe('都市と州(例: San Francisco, CA)'),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context }) => {
    // APIから天気データを取得
    const response = await fetch(`https://api.weather.com?location=${encodeURIComponent(context.location)}`);
    const data = await response.json();
    return {
      message: `${context.location}の現在の気温は${data.temperature}°F、天候は${data.conditions}です。`,
    };
  },
});

// リアルタイム音声プロバイダーを初期化
const voice = new OpenAIRealtimeVoice({
  realtimeConfig: {
    model: 'gpt-4o-mini-realtime',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// 音声プロバイダーにツールを追加
voice.addTools({
  getWeather: weatherTool,
});

// リアルタイムサービスに接続
await voice.connect();
```

## パラメータ \{#parameters\}

<br />

<PropertiesTable
  content={[
  {
    name: "tools",
    type: "ToolsInput",
    description:
      "音声モデルが呼び出せるツール定義を含むオブジェクト",
    isOptional: false,
  },
]}
/>

## 戻り値 \{#return-value\}

このメソッドは戻り値を返しません。

## 注意事項 \{#notes\}

* ツールは、name、description、input schema、execute function を含む Mastra のツール形式に準拠している必要があります
* このメソッドは、function calling をサポートするリアルタイムの音声プロバイダーで主に使用されます
* ツールをサポートしていない音声プロバイダーで呼び出された場合は、警告を記録して何もしません
* このメソッドで追加したツールは、関連する Agent が提供するツールと組み合わせて使用されるのが一般的です
* 最良の結果を得るには、会話を開始する前（`connect()` を呼び出す前）にツールを追加してください
* モデルがツールの使用を選択した場合、音声プロバイダーがツールハンドラーの呼び出しを自動的に処理します
* `addTools()` を複数回呼び出すと、プロバイダーの実装によっては、既存のツールが置き換えられるか、マージされる場合があります