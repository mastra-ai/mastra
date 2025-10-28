---
title: '.afterEvent() メソッド'
description: 'イベントに基づく一時停止ポイントを作成する、Mastra ワークフローの afterEvent メソッドのリファレンス。'
---

# afterEvent() \{#afterevent\}

`afterEvent()` メソッドは、ワークフロー内に中断ポイントを作成し、特定のイベントが発生するまで実行を待機してから処理を再開します。

## 構文 \{#syntax\}

```typescript
workflow.afterEvent(eventName: string): Workflow
```

## パラメーター \{#parameters\}

| パラメーター | 型     | 説明                                                                                                  |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------- |
| eventName   | string | 待機するイベント名。ワークフローの `events` 設定で定義されたイベントと一致している必要があります。     |

## 戻り値 \{#return-value\}

メソッドチェーン用にワークフローインスタンスを返します。

## 説明 \{#description\}

`afterEvent()` メソッドは、特定の名前付きイベントを待機する自動的なサスペンドポイントをワークフロー内に作成するために使用されます。ワークフローが一時停止し、外部イベントの発生を待つべき箇所を宣言的に定義する方法です。

`afterEvent()` を呼び出すと、Mastra は次の処理を行います:

1. ID `__eventName_event` の特別なステップを作成する
2. このステップが自動的にワークフローの実行をサスペンドする
3. 指定されたイベントが `resumeWithEvent()` によってトリガーされるまで、ワークフローはサスペンドされたままになる
4. イベントが発生すると、`afterEvent()` 呼び出しに続くステップから実行が再開される

このメソッドは Mastra のイベント駆動型ワークフロー機能の一部であり、サスペンド処理を手作業で実装することなく、外部システムやユーザーとのインタラクションと連携するワークフローを構築できます。

## 使用上の注意 \{#usage-notes\}

* `afterEvent()` で指定したイベントは、ワークフローの `events` 設定でスキーマとともに定義されている必要があります
* 作成される特別なステップには予測可能な ID 形式があります: `__eventName_event`（例: `__approvalReceived_event`）
* `afterEvent()` の後続ステップは、`context.inputData.resumedEvent` 経由でイベントデータにアクセスできます
* `resumeWithEvent()` が呼び出されると、そのイベントに対して定義されたスキーマに基づいてイベントデータが検証されます

## 例 \{#examples\}

### 基本的な使用方法 \{#basic-usage\}

```typescript
import { LegacyWorkflow } from '@mastra/core/workflows/legacy';

// イベントを含むワークフローを定義
const workflow = new LegacyWorkflow({
  name: 'approval-workflow',
  events: {
    approval: {
      schema: z.object({
        approved: z.boolean(),
        approverName: z.string(),
      }),
    },
  },
});

// イベント待機ポイントを持つワークフローを構築
workflow
  .step(submitRequest)
  .afterEvent('approval') // ワークフローはここで待機します
  .step(processApproval) // このステップはイベント発生後に実行されます
  .commit();
```

## 関連項目 \{#related\}

* [イベント駆動ワークフロー](./events)
* [resumeWithEvent()](./resumeWithEvent)
* [サスペンドと再開](/docs/examples/workflows_legacy/suspend-and-resume)
* [Workflow クラス](./workflow)