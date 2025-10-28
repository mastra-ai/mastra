---
title: "高度な使い方"
description: このページでは、Mastra のツールにおける中断シグナルや、Vercel AI SDK のツール形式との互換性などの高度な機能について説明します。
---

# 応用的な使い方 \{#advanced-usage\}

このページでは、Mastra でツールを使う際の、より高度なテクニックや機能について説明します。

## 中断シグナル \{#abort-signals\}

`generate()` や `stream()` でエージェントとのやり取りを開始する際、`AbortSignal` を渡せます。Mastra は、このシグナルをそのやり取り中に行われるすべてのツール実行へ自動的に転送します。

これにより、親のエージェント呼び出しが中断された場合でも、ネットワークリクエストや負荷の高い計算など、ツール内の長時間処理をキャンセルできます。

ツールの `execute` 関数の第2引数で `abortSignal` にアクセスできます。

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const longRunningTool = createTool({
  id: "long-computation",
  description: "処理に時間がかかる可能性のある計算を実行します",
  inputSchema: z.object({ /* ... */ }),
  execute: async ({ context }, { abortSignal }) => {
    // Example: Forwarding signal to fetch
    const response = await fetch("https://api.example.com/data", {
      signal: abortSignal, // ここでシグナルを渡す
    });

    if (abortSignal?.aborted) {
      console.log("ツールの実行を中断しました。");
      throw new Error("中断");
    }

    // 例: ループ中にシグナルを確認する
    for (let i = 0; i < 1000000; i++) {
      if (abortSignal?.aborted) {
        console.log("ループ中にツールの実行を中断しました。");
        throw new Error("中断");
      }
      // ... 計算処理を実行 ...
    }

    const data = await response.json();
    return { result: data };
  },\n});
```

これを使うには、エージェントを呼び出すときに `AbortController` の signal を渡します。

```typescript
import { Agent } from '@mastra/core/agent';
// 'agent' は longRunningTool が設定された Agent インスタンスだと仮定します

const controller = new AbortController();

// エージェント呼び出しを開始する
const promise = agent.generate('長時間の計算を実行してください。', {
  abortSignal: controller.signal,
});

// 必要に応じて後で:
// controller.abort();

try {
  const result = await promise;
  console.log(result.text);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('エージェントの生成は中断されました。');
  } else {
    console.error('エラーが発生しました：', error);
  }
}
```

## AI SDK ツール形式 \{#ai-sdk-tool-format\}

Mastra は、Vercel の AI SDK（`ai` パッケージ）で使用されているツール形式との互換性を保っています。`ai` パッケージの `tool` 関数でツールを定義し、Mastra の `createTool` で作成したツールとあわせて、Mastra のエージェント内でそのまま使用できます。

まず、`ai` パッケージがインストールされていることを確認してください：

```bash npm2yarn copy
npm install ai
```

Vercel AI SDK 形式で定義されたツールの例を次に示します：

```typescript filename="src/mastra/tools/vercelWeatherTool.ts" copy
import { tool } from 'ai';
import { z } from 'zod';

export const vercelWeatherTool = tool({
  description: 'Vercel AI SDK形式で現在の天気を取得します',
  parameters: z.object({
    city: z.string().describe('天気を取得する都市名'),
  }),
  execute: async ({ city }) => {
    console.log(`${city}の天気を取得中（Vercel形式ツール）`);
    // 実際のAPI呼び出しに置き換えてください
    const data = await fetch(`https://api.example.com/weather?city=${city}`);
    return data.json();
  },
});
```

その後、このツールを他のツールと同じように Mastra エージェントに追加できます。

```typescript filename="src/mastra/agents/mixedToolsAgent.ts"
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { vercelWeatherTool } from '../tools/vercelWeatherTool'; // Vercel AI SDK のツール
import { mastraTool } from '../tools/mastraTool'; // Mastra の createTool

export const mixedToolsAgent = new Agent({
  name: '複数ツール対応エージェント',
  instructions: '異なる形式で定義されたツールを利用できます。',
  model: openai('gpt-4o-mini'),
  tools: {
    weatherVercel: vercelWeatherTool,
    someMastraTool: mastraTool,
  },
});
```

Mastra は両方のツールフォーマットをサポートしており、必要に応じて組み合わせて使えます。
