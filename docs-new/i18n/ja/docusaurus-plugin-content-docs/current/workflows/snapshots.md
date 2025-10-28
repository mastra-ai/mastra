---
title: "スナップショット"
description: "Mastra のスナップショットでワークフローの実行状態を保存し、再開する方法を学びます"
sidebar_position: 8
---

# スナップショット \{#snapshots\}

Mastra において、スナップショットは特定時点でのワークフローの完全な実行状態をシリアライズ可能な形式で表したものです。スナップショットは、以下を含め、ワークフローを中断したまさにその地点から再開するために必要なすべての情報を保持します。

* ワークフロー内の各ステップの現在の状態
* 完了したステップの出力
* ワークフロー内でたどられた実行経路
* 一時停止中のステップとそのメタデータ
* 各ステップの残りの再試行回数
* 実行再開に必要な追加のコンテキストデータ

スナップショットは、ワークフローが一時停止されるたびに Mastra によって自動的に作成・管理され、設定済みのストレージシステムに永続化されます。

## サスペンドと再開におけるスナップショットの役割 \{#the-role-of-snapshots-in-suspend-and-resume\}

スナップショットは、Mastra のサスペンド／再開機能を支える中核的な仕組みです。ワークフローのステップで `await suspend()` が呼び出されると、次のことが起こります。

1. ワークフローの実行がその時点で一時停止される
2. ワークフローの現在の状態がスナップショットとして取得される
3. スナップショットがストレージに保存される
4. ワークフローのステップはステータス `'suspended'` の「サスペンド中」としてマークされる
5. 後に中断されたステップで `resume()` が呼び出されると、スナップショットが取得される
6. ワークフローの実行は中断したまさにその地点から再開される

この仕組みにより、ヒューマン・イン・ザ・ループのワークフローの実装、レート制限への対応、外部リソースの待機、長時間の一時停止を要する複雑な分岐ワークフローの実装が強力に可能になります。

## スナップショットの構成 \{#snapshot-anatomy\}

各スナップショットには、`runId`、入力、ステップのステータス（`success`、`suspended` など）、サスペンドおよびリジューム時のペイロード、最終的な出力が含まれます。これにより、実行を再開する際に必要なコンテキストがすべて揃います。

```json
{
  "runId": "34904c14-e79e-4a12-9804-9655d4616c50",
  "status": "success",
  "value": {},
  "context": {
    "input": { "value": 100, "user": "Michael", "requiredApprovers": ["manager", "finance"] },
    "approval-step": {
      "payload": { "value": 100, "user": "Michael", "requiredApprovers": ["manager", "finance"] },
      "startedAt": 1758027577955,
      "status": "success",
      "suspendPayload": {
        "message": "ワークフローを一時停止しました",
        "requestedBy": "Michael",
        "approvers": ["manager", "finance"]
      },
      "suspendedAt": 1758027578065,
      "resumePayload": { "confirm": true, "approver": "manager" },
      "resumedAt": 1758027578517,
      "output": { "value": 100, "approved": true },
      "endedAt": 1758027578634
    }
  },
  "activePaths": [],
  "serializedStepGraph": [
    { "type": "step", "step": { "id": "approval-step", "description": "値を受け取り、確認を待ちます" } }
  ],
  "suspendedPaths": {},
  "waitingPaths": {},
  "result": { "value": 100, "approved": true },
  "runtimeContext": {},
  "timestamp": 1758027578740
}
```

## スナップショットの保存と取得方法 \{#how-snapshots-are-saved-and-retrieved\}

スナップショットは、設定したストレージシステムに保存されます。既定では LibSQL を使用しますが、代わりに Upstash や PostgreSQL を利用するように設定することもできます。各スナップショットは `workflow_snapshots` テーブルに保存され、ワークフローの `runId` で識別されます。

詳しくは次をご覧ください:

* [LibSQL Storage](/docs/reference/storage/libsql)
* [Upstash Storage](/docs/reference/storage/upstash)
* [PostgreSQL Storage](/docs/reference/storage/postgresql)

### スナップショットの保存 \{#saving-snapshots\}

ワークフローが一時停止されると、Mastra は次の手順でワークフローのスナップショットを自動的に永続化します:

1. ステップ実行内で `suspend()` 関数がスナップショット処理を開始する
2. `WorkflowInstance.suspend()` メソッドが一時停止中のマシンを記録する
3. 現在の状態を保存するために `persistWorkflowSnapshot()` が呼び出される
4. スナップショットがシリアライズされ、設定済みデータベースの `workflow_snapshots` テーブルに保存される
5. 保存レコードには、ワークフロー名、実行 ID、シリアライズ済みスナップショットが含まれる

### スナップショットの取得 \{#retrieving-snapshots\}

ワークフローが再開されると、Mastra は以下の手順で永続化されたスナップショットを取得します。

1. 特定のステップ ID を指定して `resume()` メソッドが呼び出される
2. `loadWorkflowSnapshot()` を用いてストレージからスナップショットを読み込む
3. スナップショットを解析し、再開に向けて準備する
4. スナップショットの状態を用いてワークフロー実行を再構築する
5. 一時停止していたステップを再開し、実行を続行する

```typescript
const storage = mastra.getStorage();

const snapshot = await storage!.loadWorkflowSnapshot({
  runId: '<run-id>',
  workflowName: '<workflow-id>',
});

console.log(snapshot);
```

## スナップショットのストレージオプション \{#storage-options-for-snapshots\}

スナップショットは、`Mastra` クラスで構成された `storage` インスタンスを介して永続化されます。このストレージレイヤーは、そのインスタンスに登録されたすべてのワークフローで共有されます。Mastra は、さまざまな環境に柔軟に対応できるよう、複数のストレージオプションをサポートしています。

### LibSQL `@mastra/libsql` \{#libsql-mastralibsql\}

この例では、LibSQL のスナップショットの使い方を示します。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';

export const mastra = new Mastra({
  // ...
  storage: new LibSQLStore({
    url: ':memory:',
  }),
});
```

### Upstash `@mastra/upstash` \{#upstash-mastraupstash\}

この例では、Upstash でスナップショットを使用する方法を紹介します。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { UpstashStore } from '@mastra/upstash';

export const mastra = new Mastra({
  // ...
  storage: new UpstashStore({
    url: '<upstash-redis-rest-url>',
    token: '<upstash-redis-rest-token>',
  }),
});
```

### Postgres `@mastra/pg` \{#postgres-mastrapg\}

この例では、PostgreSQLでスナップショットを使用する方法を紹介します。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { PostgresStore } from '@mastra/pg';

export const mastra = new Mastra({
  // ...
  storage: new PostgresStore({
    connectionString: '<データベース-URL>',
  }),
});
```

## ベストプラクティス \{#best-practices\}

1. **シリアライズ可能性の確保**: スナップショットに含める必要があるデータはすべてシリアライズ可能（JSON に変換可能）である必要があります。
2. **スナップショットの小型化**: 大きなデータオブジェクトをワークフローのコンテキストに直接保存するのは避けてください。代わりに、それらへの参照（ID など）を保存し、必要なときにデータを取得します。
3. **再開時コンテキストの慎重な扱い**: ワークフローを再開する際に、どのコンテキストを渡すかを慎重に検討してください。指定したコンテキストは既存のスナップショットデータにマージされます。
4. **適切な監視の導入**: 中断中のワークフロー、特に長時間実行のものに対して監視を導入し、確実に再開されるようにします。
5. **ストレージのスケーリングの考慮**: 多数の中断中ワークフローを抱えるアプリケーションでは、ストレージソリューションが適切にスケールしていることを確認してください。

## カスタムスナップショットメタデータ \{#custom-snapshot-metadata\}

`suspendSchema` を定義すると、ワークフローを一時停止する際にカスタムメタデータを付与できます。このメタデータはスナップショットに保存され、ワークフロー再開時に利用可能になります。

```typescript {30-34} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const approvalStep = createStep({
  id: 'approval-step',
  description: '値を受け取り、承認を待機します',
  inputSchema: z.object({
    value: z.number(),
    user: z.string(),
    requiredApprovers: z.array(z.string()),
  }),
  suspendSchema: z.object({
    message: z.string(),
    requestedBy: z.string(),
    approvers: z.array(z.string()),
  }),
  resumeSchema: z.object({
    confirm: z.boolean(),
    approver: z.string(),
  }),
  outputSchema: z.object({
    value: z.number(),
    approved: z.boolean(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { value, user, requiredApprovers } = inputData;
    const { confirm } = resumeData ?? {};

    if (!confirm) {
      return await suspend({
        message: 'ワークフローを一時停止しました',
        requestedBy: user,
        approvers: [...requiredApprovers],
      });
    }

    return {
      value,
      approved: confirm,
    };
  },
});
```

### 履歴データの提供 \{#providing-resume-data\}

一時停止されたステップを再開する際は、構造化された入力を渡すために `resumeData` を使用します。ステップの `resumeSchema` に適合している必要があります。

```typescript {14-20} showLineNumbers copy
const workflow = mastra.getWorkflow('approvalWorkflow');

const run = await workflow.createRunAsync();

const result = await run.start({
  inputData: {
    value: 100,
    user: 'Michael',
    requiredApprovers: ['manager', 'finance'],
  },
});

if (result.status === 'suspended') {
  const resumedResult = await run.resume({
    step: 'approval-step',
    resumeData: {
      confirm: true,
      approver: 'manager',
    },
  });
}
```

## 関連 \{#related\}

* [一時停止と再開](/docs/workflows/suspend-and-resume)
* [Human-in-the-loop の例](/docs/examples/workflows/human-in-the-loop)
* [WorkflowRun.watch()](/docs/reference/workflows/run-methods/watch)