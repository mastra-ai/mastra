---
title: "イベント駆動ワークフロー（レガシー）"
description: "Mastra で afterEvent と resumeWithEvent メソッドを使って、イベント駆動ワークフローを作成する方法を学びます。"
---

# イベント駆動型ワークフロー \{#event-driven-workflows\}

Mastra は、`afterEvent` と `resumeWithEvent` メソッドにより、イベント駆動型ワークフローを標準でサポートしています。これらのメソッドを使うと、特定のイベントの発生を待つあいだ実行を一時停止し、イベントデータが利用可能になった時点でそのデータを用いて再開するワークフローを作成できます。

## 概要 \{#overview\}

イベント駆動型ワークフローは、次のようなシナリオで有効です:

* 外部システムの処理完了を待つ必要がある場合
* 特定のポイントでユーザーの承認または入力が必要になる場合
* 非同期処理を調整する必要がある場合
* 長時間実行されるプロセスを複数のサービスにまたがって分割して実行する必要がある場合

## イベントの定義 \{#defining-events\}

イベント駆動のメソッドを使用する前に、ワークフローが待ち受けるイベントをワークフロー設定で定義する必要があります。

```typescript
import { LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

const workflow = new LegacyWorkflow({
  name: 'approval-workflow',
  triggerSchema: z.object({ requestId: z.string() }),
  events: {
    // 各イベントとその検証用スキーマを定義
    approvalReceived: {
      schema: z.object({
        approved: z.boolean(),
        approverName: z.string(),
        comment: z.string().optional(),
      }),
    },
    documentUploaded: {
      schema: z.object({
        documentId: z.string(),
        documentType: z.enum(['invoice', 'receipt', 'contract']),
        metadata: z.record(z.string()).optional(),
      }),
    },
  },
});
```

各イベントには、発生時に想定されるデータの構造を定義する名前とスキーマが必要です。

## afterEvent() \{#afterevent\}

`afterEvent` メソッドは、特定のイベントが発生するまで自動的に待機する中断ポイントをワークフロー内に作成します。

### 構文 \{#syntax\}

```typescript
workflow.afterEvent(eventName: string): LegacyWorkflow
```

### パラメータ \{#parameters\}

* `eventName`: 待機するイベント名（ワークフローの `events` 設定で定義されている必要があります）

### 戻り値 \{#return-value\}

メソッドチェーン用にワークフローインスタンスを返します。

### 仕組み \{#how-it-works\}

`afterEvent` が呼び出されると、Mastra は次の処理を行います:

1. ID `__eventName_event` の特別なステップを作成する
2. このステップを、ワークフロー実行を自動的に一時停止するように設定する
3. イベント受信後の再開ポイントを設定する

### 使い方の例 \{#usage-example\}

```typescript
workflow
  .step(initialProcessStep)
  .afterEvent('approvalReceived') // ワークフローはここで待機します
  .step(postApprovalStep) // イベント受信後に実行されます
  .then(finalStep)
  .commit();
```

## resumeWithEvent() \{#resumewithevent\}

`resumeWithEvent` メソッドは、特定のイベント用のデータを提供して、一時停止中のワークフローを再開します。

### 構文 \{#syntax\}

```typescript
run.resumeWithEvent(eventName: string, data: any): Promise<LegacyWorkflowRunResult>
```

### パラメータ \{#parameters\}

* `eventName`: トリガーされるイベントの名称
* `data`: イベントデータ（このイベント用に定義されたスキーマに準拠している必要があります）

### 戻り値 \{#return-value\}

再開後のワークフロー実行結果で解決される Promise を返します。

### 仕組み \{#how-it-works\}

`resumeWithEvent` が呼び出されると、Mastra は次の処理を行います。

1. そのイベント用に定義されたスキーマに照らしてイベントデータを検証する
2. ワークフローのスナップショットを読み込む
3. イベントデータでコンテキストを更新する
4. そのイベントのステップから実行を再開する
5. 後続のステップへとワークフローの実行を進める

### 使い方の例 \{#usage-example\}

```typescript
// ワークフローの実行を作成する
const run = workflow.createRun();

// ワークフローを開始する
await run.start({ triggerData: { requestId: 'req-123' } });

// 後で、イベントが発生したとき：
const result = await run.resumeWithEvent('approvalReceived', {
  approved: true,
  approverName: 'John Doe',
  comment: '問題なさそうです！',
});

console.log(result.results);
```

## イベントデータへのアクセス \{#accessing-event-data\}

ワークフローがイベントデータとともに再開されると、そのデータはステップコンテキスト内の `context.inputData.resumedEvent` で参照できます。

```typescript
const processApprovalStep = new LegacyStep({
  id: 'processApproval',
  execute: async ({ context }) => {
    // イベントデータへアクセス
    const eventData = context.inputData.resumedEvent;

    return {
      processingResult: `${eventData.approverName} による承認を処理しました`,
      wasApproved: eventData.approved,
    };
  },
});
```

## 複数のイベント \{#multiple-events\}

ワークフローの各所で複数の異なるイベントを待機するように設定できます：

```typescript
workflow
  .step(createRequest)
  .afterEvent('承認受領')
  .step(processApproval)
  .afterEvent('ドキュメントアップロード完了')
  .step(processDocument)
  .commit();
```

複数のイベントで中断ポイントがあるワークフローを再開する場合は、現在の中断ポイントに対して正しいイベント名とデータを指定する必要があります。

## 実践例 \{#practical-example\}

この例では、承認とドキュメントのアップロードの双方を必要とする、完全なワークフローを示します。

```typescript
import { LegacyWorkflow, LegacyStep } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

// ステップを定義
const createRequest = new LegacyStep({
  id: 'createRequest',
  execute: async () => ({ requestId: `req-${Date.now()}` }),
});

const processApproval = new LegacyStep({
  id: 'processApproval',
  execute: async ({ context }) => {
    const approvalData = context.inputData.resumedEvent;
    return {
      approved: approvalData.approved,
      approver: approvalData.approverName,
    };
  },
});

const processDocument = new LegacyStep({
  id: 'processDocument',
  execute: async ({ context }) => {
    const documentData = context.inputData.resumedEvent;
    return {
      documentId: documentData.documentId,
      processed: true,
      type: documentData.documentType,
    };
  },
});

const finalizeRequest = new LegacyStep({
  id: 'finalizeRequest',
  execute: async ({ context }) => {
    const requestId = context.steps.createRequest.output.requestId;
    const approved = context.steps.processApproval.output.approved;
    const documentId = context.steps.processDocument.output.documentId;

      finalized: true,
      finalized: true,
      summary: `リクエスト ${requestId} は文書 ${documentId} により ${approved ? '承認' : '却下'} されました`,
    };
  },
});

// ワークフローを作成
const requestWorkflow = new LegacyWorkflow({
  name: 'document-request-workflow',
  events: {
    approvalReceived: {
      schema: z.object({
        approved: z.boolean(),
        approverName: z.string(),
      }),
    },
    documentUploaded: {
      schema: z.object({
        documentId: z.string(),
        documentType: z.enum(['invoice', 'receipt', 'contract']),
        documentType: z.enum(['invoice', 'receipt', 'contract']),
    },
  },
});

// ワークフローをビルド
requestWorkflow
  .step(createRequest)
  .afterEvent('approvalReceived')
  .step(processApproval)
  .afterEvent('documentUploaded')
  .step(processDocument)
  .then(finalizeRequest)
  .commit();

// ワークフローをエクスポート
export { requestWorkflow };
```

### サンプルワークフローを実行する \{#running-the-example-workflow\}

```typescript
import { requestWorkflow } from './workflows';
import { mastra } from './mastra';

async function runWorkflow() {
  // ワークフローを取得
  const workflow = mastra.legacy_getWorkflow('document-request-workflow');
  const run = workflow.createRun();

  // Start the workflow
  const initialResult = await run.start();
  console.log('ワークフローを開始:', initialResult.results);

  // 承認の受領をシミュレート
  const afterApprovalResult = await run.resumeWithEvent('approvalReceived', {
    approved: true,
    approverName: 'Jane Smith',
  });
  console.log('承認後:', afterApprovalResult.results);

  // ドキュメントのアップロードをシミュレート
  const finalResult = await run.resumeWithEvent('documentUploaded', {
    documentId: 'doc-456',
    documentType: 'invoice',
  });
  console.log('最終結果:', finalResult.results);
}

runWorkflow().catch(console.error);
```

## ベストプラクティス \{#best-practices\}

1. **明確なイベントスキーマを定義する**: Zod を用いてイベントデータ検証のための正確なスキーマを作成する
2. **分かりやすいイベント名を使う**: 目的が明確に伝わるイベント名を選ぶ
3. **未発生のイベントをハンドリングする**: イベントが発生しない、またはタイムアウトするケースにもワークフローが対応できるようにする
4. **監視を組み込む**: `watch` メソッドでイベントを待機してサスペンドしているワークフローを監視する
5. **タイムアウトを検討する**: 発生しない可能性のあるイベントにはタイムアウト機構を実装する
6. **イベントをドキュメント化する**: 他の開発者のために、ワークフローが依存するイベントを明確に記載する

## 関連 \{#related\}

* [ワークフローの一時停止と再開](/docs/examples/workflows_legacy/suspend-and-resume)
* [Workflow クラスリファレンス](./workflow)
* [resume メソッドリファレンス](./resume)
* [watch メソッドリファレンス](./watch)
* [after イベントリファレンス](./afterEvent)
* [resumeWithEvent リファレンス](./resumeWithEvent)