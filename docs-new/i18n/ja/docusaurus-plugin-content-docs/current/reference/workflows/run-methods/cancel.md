---
title: "Run.cancel() "
description: ワークフローの実行をキャンセルする、`Run.cancel()` メソッドのドキュメントです。
---

# Run.cancel() \{#runcancel\}

`.cancel()` メソッドはワークフロー実行をキャンセルし、処理を停止してリソースをクリーンアップします。

## 使い方の例 \{#usage-example\}

```typescript showLineNumbers copy
const run = await workflow.createRunAsync();

await run.cancel();
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "パラメータなし",
type: "void",
description: "このメソッドは引数を取りません",
isOptional: false,
},
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "result",
type: "Promise<void>",
description: "ワークフローの実行がキャンセルされると解決される Promise",
},
]}
/>

## 応用的な使用例 \{#extended-usage-example\}

```typescript showLineNumbers copy
const run = await workflow.createRunAsync();

try {
  const result = await run.start({ inputData: { value: '初期データ' } });
} catch (error) {
  await run.cancel();
}
```

## 関連情報 \{#related\}

* [Workflows の概要](/docs/workflows/overview)
* [Run クラス](../run)