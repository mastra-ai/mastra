---
title: ".resumeWithEvent() メソッド"
description: "イベントデータを用いて一時停止中のワークフローを再開するための resumeWithEvent メソッドのリファレンス。"
---

# resumeWithEvent() \{#resumewithevent\}

`resumeWithEvent()` メソッドは、ワークフローが待機している特定のイベントに対するデータを渡すことで、ワークフローの実行を再開します。

## 構文 \{#syntax\}

```typescript
const run = workflow.createRun();

// ワークフローが開始され、イベントステップで保留状態になった後
await run.resumeWithEvent(eventName: string, data: any): Promise<WorkflowRunResult>
```

## パラメーター \{#parameters\}

| パラメーター | 型     | 説明                                                                                               |
| ------------ | ------ | -------------------------------------------------------------------------------------------------- |
| eventName    | string | トリガーするイベント名。ワークフローの `events` 設定で定義されたイベントと一致している必要があります。 |
| data         | any    | 提供するイベントデータ。そのイベントに定義されたスキーマに準拠している必要があります。                |

## 返り値 \{#return-value\}

次の内容を含む `WorkflowRunResult` オブジェクトに解決される Promise を返します:

* `results`: ワークフロー内の各ステップの結果ステータスと出力
* `activePaths`: アクティブなワークフロー パスとその状態のマップ
* `value`: ワークフローの現在の状態値
* その他のワークフロー実行メタデータ

## 説明 \{#description\}

`resumeWithEvent()` メソッドは、`afterEvent()` メソッドで作成されたイベントステップで一時停止しているワークフローを再開するために使用されます。呼び出すと、このメソッドは次の処理を行います:

1. 提供されたイベントデータを、そのイベント用に定義されたスキーマに照らして検証する
2. ストレージからワークフローのスナップショットを読み込む
3. コンテキストの `resumedEvent` フィールドにイベントデータを設定して更新する
4. 当該イベントステップから実行を再開する
5. 続くステップでワークフローの実行を継続する

このメソッドは Mastra のイベント駆動型ワークフロー機能の一部であり、外部イベントやユーザーの操作に反応するワークフローを作成できます。

## 使用上の注意 \{#usage-notes\}

* ワークフローは一時停止中である必要があり、特に `afterEvent(eventName)` によって作成されたイベントステップで停止していなければなりません
* イベントデータは、ワークフロー設定でそのイベントに定義されたスキーマに適合している必要があります
* ワークフローは一時停止した時点から実行を再開します
* ワークフローが一時停止していない、または別のステップで一時停止している場合、このメソッドはエラーを投げることがあります
* イベントデータは `context.inputData.resumedEvent` を介して後続のステップで利用できます

## 例 \{#examples\}

### 基本的な使用方法 \{#basic-usage\}

```typescript
// ワークフローを定義して開始する
const workflow = mastra.legacy_getWorkflow('approval-workflow');
const run = workflow.createRun();

// ワークフローを開始する
await run.start({ triggerData: { requestId: 'req-123' } });

// 後で、承認イベントが発生したとき：
const result = await run.resumeWithEvent('approval', {
  approved: true,
  approverName: 'John Doe',
  comment: '良さそうです！',
});

console.log(result.results);
```

### エラー処理を含む \{#with-error-handling\}

```typescript
try {
  const result = await run.resumeWithEvent('paymentReceived', {
    amount: 100.5,
    transactionId: 'tx-456',
    paymentMethod: 'credit-card',
  });

  console.log('ワークフローの再開に成功しました:', result.results);
} catch (error) {
  console.error('イベントによるワークフローの再開に失敗しました:', error);
  // エラー処理: 無効なイベントデータ、ワークフローが一時停止状態でない、などの可能性があります
}
```

### 監視と自動復帰 \{#monitoring-and-auto-resuming\}

```typescript
// ワークフローを開始する
const { start, watch, resumeWithEvent } = workflow.createRun();

// 一時停止中のイベントステップを監視する
watch(async ({ activePaths }) => {
  const isApprovalEventSuspended = activePaths.get('__approval_event')?.status === 'suspended';
  // 承認イベントのステップで一時停止しているか確認
  if (isApprovalEventSuspended) {
    console.log('承認待ちのワークフローです');

    // 実運用では実際のイベントを待機します
    // ここではタイムアウトで擬似的に実行します
    setTimeout(async () => {
      try {
        await resumeWithEvent('approval', {
          approved: true,
          approverName: '自動承認者',
        });
      } catch (error) {
        console.error('ワークフローの自動再開に失敗しました:', error);
      }
    }, 5000); // 自動承認まで5秒待つ
  }
});

// ワークフローを開始する
await start({ triggerData: { requestId: 'auto-123' } });
```

## 関連 \{#related\}

* [イベント駆動ワークフロー](./events)
* [afterEvent()](./afterEvent)
* [一時停止と再開](/docs/workflows/suspend-and-resume)
* [resume()](./resume)
* [watch()](./watch)