---
title: "Step "
description: ワークフロー内の個々の作業単位を定義する Step クラスのドキュメントです。
---

# Step \{#step\}

Step クラスは、ワークフロー内の個々の作業単位を定義し、実行ロジック、データ検証、入出力処理をまとめてカプセル化します。

## 使い方 \{#usage\}

```typescript
const processOrder = new LegacyStep({
  id: 'processOrder',
  inputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
  }),
  outputSchema: z.object({
    status: z.string(),
    orderId: z.string(),
  }),
  execute: async ({ context, runId }) => {
    return {
      status: '処理済み',
      orderId: context.orderId,
    };
  },
});
```

## コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "id",
type: "string",
description: "ステップの一意の識別子",
required: true,
},
{
name: "inputSchema",
type: "z.ZodSchema",
description: "実行前に入力データを検証するためのZodスキーマ",
required: false,
},
{
name: "outputSchema",
type: "z.ZodSchema",
description: "ステップの出力データを検証するためのZodスキーマ",
required: false,
},
{
name: "payload",
type: "Record<string, any>",
description: "変数にマージされる静的データ",
required: false,
},
{
name: "execute",
type: "(params: ExecuteParams) => Promise<any>",
description: "ステップのロジックを実装する非同期関数",
required: true,
},
]}
/>

### ExecuteParams \{#executeparams\}

<PropertiesTable
  content={[
{
name: "context",
type: "StepContext",
description: "ワークフローのコンテキストとステップ結果へのアクセス",
},
{
name: "runId",
type: "string",
description: "現在のワークフロー実行の一意の識別子",
},
{
name: "suspend",
type: "() => Promise<void>",
description: "ステップ実行を一時停止する関数",
},
{
name: "mastra",
type: "Mastra",
description: "Mastra インスタンスへのアクセス",
},
]}
/>

## 関連情報 \{#related\}

* [ワークフローリファレンス](./workflow)
* [ステップ設定ガイド](/docs/workflows/overview)
* [制御フローガイド](/docs/workflows/control-flow)