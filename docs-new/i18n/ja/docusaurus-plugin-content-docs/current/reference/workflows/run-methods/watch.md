---
title: "Run.watch()"
description: ワークフローの `Run.watch()` メソッドに関するドキュメント。ワークフロー実行を監視できます。
---

# Run.watch() \{#runwatch\}

`.watch()` メソッドを使うと、ワークフローの実行を監視し、各ステップの進行状況についてリアルタイムで更新を受け取れます。

## 使い方の例 \{#usage-example\}

```typescript showLineNumbers copy
const run = await workflow.createRunAsync();

run.watch(event => {
  console.log(event?.payload?.currentStep?.id);
});

const result = await run.start({ inputData: { value: '初期データ' } });
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "callback",
type: "(event: WatchEvent) => void",
description: "ステップの完了またはワークフローの状態変更時に呼び出されるコールバック関数。event パラメータには、type（'watch'）、payload（currentStep と workflowState）、eventTimestamp が含まれます",
isOptional: false,
},
{
name: "type",
type: "'watch' | 'watch-v2'",
description: "リッスンする監視イベントの種類。ステップ完了イベントには 'watch'、データストリームイベントには 'watch-v2' を指定します",
isOptional: true,
defaultValue: "'watch'",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "unwatch",
type: "() => void",
description:
"ワークフロー実行の監視を停止するために呼び出せる関数です。",
},
]}
/>

## 追加の使用例 \{#extended-usage-example\}

```typescript showLineNumbers copy
const run = await workflow.createRunAsync();

run.watch(event => {
  console.log(event?.payload?.currentStep?.id);
}, 'watch');

const result = await run.start({ inputData: { value: '初期データ' } });
```

## 関連情報 \{#related\}

## 関連項目 \{#related\}

* [Workflows の概要](/docs/workflows/overview)
* [Run クラス](../run)
* [Workflow の監視](/docs/workflows/overview#watch-workflow)