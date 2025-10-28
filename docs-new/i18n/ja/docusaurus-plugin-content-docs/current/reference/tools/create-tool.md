---
title: "createTool() "
description: Mastra の `createTool()` 関数に関するドキュメント。エージェント向けのカスタムツールを定義するために使用します。
---

# createTool() \{#createtool\}

`createTool()` 関数は、Mastra エージェントが実行できるカスタムツールを定義するために使用します。ツールは、外部システムとの連携、計算の実行、特定のデータへのアクセスを可能にすることで、エージェントの機能を拡張します。

## 使用例 \{#usage-example\}

```typescript filename="src/mastra/tools/reverse-tool.ts" showLineNumbers copy
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const tool = createTool({
  id: 'test-tool',
  description: '入力文字列を反転する',
  inputSchema: z.object({
    input: z.string(),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ context }) => {
    const { input } = context;
    const reversed = input.split('').reverse().join('');

    return {
      output: reversed,
    };
  },
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "id",
type: "string",
description: "ツールの一意の識別子。",
isOptional: false,
},
{
name: "description",
type: "string",
description:
"ツールの機能の説明。エージェントがツールをいつ使用すべきか判断するために使われます。",
isOptional: false,
},
{
name: "inputSchema",
type: "Zod schema",
description:
"ツールの `execute` 関数に対して想定される入力パラメータを定義する Zod スキーマ。",
isOptional: true,
},
{
name: "outputSchema",
type: "Zod schema",
description:
"ツールの `execute` 関数に対して想定される出力構造を定義する Zod スキーマ。",
isOptional: true,
},
{
name: "execute",
type: "function",
description:
"ツールのロジックを含む関数。`context`（`inputSchema` に基づいて解析された入力）、`runtimeContext`、`tracingContext`、および `abortSignal` を含むオブジェクトを受け取ります。",
isOptional: false,
properties: [
{
parameters: [{
name: "context",
type: "z.infer<TInput>",
description: "inputSchema に基づいて解析された入力"
}]
},
{
parameters: [{
name: "runtimeContext",
type: "RuntimeContext",
isOptional: true,
description: "共有状態や依存関係にアクセスするためのランタイムコンテキスト"
}]
},
{
parameters: [{
name: "tracingContext",
type: "TracingContext",
isOptional: true,
description: "子スパンの作成やメタデータの追加のための AI トレーシング用コンテキスト。トレース対象の処理内でツールが呼び出される場合は自動的に注入されます。"
}]
},
{
parameters: [{
name: "abortSignal",
type: "AbortSignal",
isOptional: true,
description: "ツール実行を中止するためのシグナル"
}]
}
]
},
]}
/>

## 戻り値 \{#returns\}

`createTool()` 関数は `Tool` オブジェクトを返します。

<PropertiesTable
  content={[
{
name: "Tool",
type: "object",
description:
"定義したツールを表すオブジェクトで、エージェントに追加する準備ができています。",
},
]}
/>

## 関連項目 \{#related\}

* [ツールの概要](/docs/tools-mcp/overview)
* [エージェントでのツール活用](/docs/agents/using-tools-and-mcp)
* [ツールのランタイムコンテキスト](/docs/tools-mcp/runtime-context)
* [ツールの高度な使い方](/docs/tools-mcp/advanced-usage)