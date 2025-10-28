---
title: "ランタイムコンテキスト"
description: Mastra の RuntimeContext を使って、ツールに対してリクエストごとに異なる動的な設定を提供する方法を学びます。
unlisted: true
---

# ツールのランタイムコンテキスト \{#tool-runtime-context\}

Mastra には、ランタイム変数でツールを設定できる依存性注入システム `RuntimeContext` が用意されています。似た処理を行うツールを複数作っている場合は、ランタイムコンテキストを使うことで、それらをより柔軟な単一のツールに統合できます。

## 概要 \{#overview\}

依存性注入システムによって、次のことが可能になります：

1. 型安全な `runtimeContext` を通じて、実行時の設定変数をツールに渡す。
2. ツールの実行コンテキスト内でそれらの変数にアクセスする。
3. 基盤コードを変更せずにツールの挙動を調整する。
4. 同一エージェント内の複数のツール間で設定を共有する。

:::note

**注:** `RuntimeContext` は主に、ツールの実行へデータを渡すために使用されます。これは、会話履歴や複数回の呼び出しにわたる状態の永続化を扱うエージェントメモリとは異なります。

:::

## ツールでの `runtimeContext` へのアクセス \{#accessing-runtimecontext-in-tools\}

ツールは親エージェントと同じ `runtimeContext` にアクセスでき、実行時の設定に基づいて動作を調整できます。次の例では、エージェントの指示と一貫したフォーマットを保つために、ツールの `execute` 関数内で `temperature-unit` を取得しています。

```typescript {14-15} filename="src/mastra/tools/test-weather-tool" showLineNumbers copy
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

type WeatherRuntimeContext = {
  'temperature-unit': 'celsius' | 'fahrenheit';
};

export const testWeatherTool = createTool({
  id: 'getWeather',
  description: '指定した場所の現在の天気を取得します',
  inputSchema: z.object({
    location: z.string().describe('天気を取得する場所'),
  }),
  execute: async ({ context, runtimeContext }) => {
    const temperatureUnit = runtimeContext.get('temperature-unit') as WeatherRuntimeContext['temperature-unit'];

    const weather = await fetchWeather(context.location, temperatureUnit);

    return { result: weather };
  },
});

async function fetchWeather(location: string, temperatureUnit: WeatherRuntimeContext['temperature-unit']) {
  // ...
}
```

## 関連項目 \{#related\}

[Agent Runtime Context](/docs/server-db/runtime-context)