---
title: 動的ツールの例 | ツール | Mastra ドキュメント
description: Mastra でランタイムコンテキストを使って動的ツールを作成・構成する方法を学びます。
---

# ダイナミックツール \{#dynamic-tools\}

ダイナミックツールは、文脈的な入力に応じて実行時に振る舞いと機能を適応的に変化させます。固定の設定に頼るのではなく、ユーザーや環境、シナリオに合わせて調整し、単一のエージェントが文脈を踏まえたパーソナライズされた応答を提供できるようにします。

## ツールの作成 \{#creating-an-tool\}

`runtimeContext` で提供される動的な値を用いて為替レートのデータを取得するツールを作成します。

```typescript filename="src/mastra/tools/example-exchange-rates-tool.ts" showLineNumbers copy
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const getExchangeRatesTool = createTool({
  id: 'get-exchange-rates-tool',
  description: '通貨の為替レートを取得します',
  inputSchema: z.null(),
  outputSchema: z.object({
    base: z.string(),
    date: z.string(),
    rates: z.record(z.number()),
  }),
  execute: async ({ runtimeContext }) => {
    const currency = runtimeContext.get('currency');

    const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${currency}`);

    const { base, date, rates } = await response.json();

    return { base, date, rates };
  },
});
```

> 設定オプションの全一覧は [createTool()](/docs/reference/tools/create-tool) を参照してください。

## 使用例 \{#example-usage\}

`set()` を使って `RuntimeContext` を設定し、`runtimeContext` を渡して `execute()` を呼び出します。

```typescript filename="src/test-exchange-rate.ts" showLineNumbers copy
import { RuntimeContext } from '@mastra/core/runtime-context';
import { getExchangeRatesTool } from '../src/mastra/tools/example-exchange-rates-tool';

const runtimeContext = new RuntimeContext();

runtimeContext.set('currency', 'USD');

const result = await getExchangeRatesTool.execute({
  context: null,
  runtimeContext,
});

console.log(result);
```

## 関連情報 \{#related\}

* [ツールの呼び出し](./calling-tools#from-the-command-line)