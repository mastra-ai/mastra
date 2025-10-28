---
title: "run.watch() "
description: ワークフローで使用する`.watch()`メソッドのドキュメント。ワークフロー実行のステータスを監視します。
---

# run.watch() \{#runwatch\}

`.watch()` 関数は、mastra の run の状態変化を購読し、実行の進捗を監視して状態更新に応答できるようにします。

## 使い方の例 \{#usage-example\}

```typescript
import { LegacyWorkflow } from '@mastra/core/workflows/legacy';

const workflow = new LegacyWorkflow({
  name: 'document-processor',
});

const run = workflow.createRun();

// 状態変更を監視
const unsubscribe = run.watch(({ results, activePaths }) => {
  console.log('結果:', results);
  console.log('アクティブパス:', activePaths);
});

// ワークフローを実行
await run.start({
  input: { text: 'このドキュメントを処理' },
});

// 監視を停止
unsubscribe();
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "callback",
type: "(state: LegacyWorkflowState) => void",
description: "ワークフローの状態が変化するたびに呼び出される関数",
isOptional: false,
},
]}
/>

### LegacyWorkflowState のプロパティ \{#legacyworkflowstate-properties\}

<PropertiesTable
  content={[
{
name: "results",
type: "Record<string, any>",
description: "完了したワークフローの各ステップの出力",
isOptional: false,
},
{
name: "activePaths",
type: "Map<string, { status: string; suspendPayload?: any; stepPath: string[] }>",
description: "各ステップの現在の状態",
isOptional: false,
},
{
name: "runId",
type: "string",
description: "ワークフロー実行のID",
isOptional: false,
},
{
name: "timestamp",
type: "number",
description: "ワークフロー実行のタイムスタンプ",
isOptional: false,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "unsubscribe",
type: "() => void",
description: "ワークフローの状態変更の監視を停止する関数",
},
]}
/>

## 追加の例 \{#additional-examples\}

特定のステップの完了をモニタリングする：

```typescript
run.watch(({ results, activePaths }) => {
  if (activePaths.get('processDocument')?.status === 'completed') {
    console.log('ドキュメント処理の出力:', results['processDocument'].output);
  }
});
```

エラー処理:

```typescript
run.watch(({ results, activePaths }) => {
  if (activePaths.get('processDocument')?.status === 'failed') {
    console.error('ドキュメント処理に失敗しました:', results['processDocument'].error);
    // エラー回復ロジックを実装
  }
});
```

### 関連項目 \{#related\}

* [ワークフローの作成](./createRun)
* [ステップの設定](./step-class)