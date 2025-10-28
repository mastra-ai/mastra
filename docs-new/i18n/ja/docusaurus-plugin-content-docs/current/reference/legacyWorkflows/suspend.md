---
title: "suspend() "
description: "Mastra ワークフローにおける suspend 関数のドキュメント。実行を再開するまで処理を一時停止します。"
---

# suspend() \{#suspend\}

現在のステップでワークフローの実行を一時停止し、明示的に再開されるまで待機します。ワークフローの状態は保持され、後から再開できます。

## 使い方の例 \{#usage-example\}

```typescript
const approvalStep = new LegacyStep({
  id: 'needsApproval',
  execute: async ({ context, suspend }) => {
    if (context.steps.amount > 1000) {
      await suspend();
    }
    return { approved: true };
  },
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "metadata",
type: "Record<string, any>",
description: "サスペンド状態とともに保存する任意のデータ",
isOptional: true,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "Promise<void>",
type: "Promise",
description: "ワークフローの一時停止に成功すると解決されます",
},
]}
/>

## 追加例 \{#additional-examples\}

メタデータ付きの suspend:

```typescript
const reviewStep = new LegacyStep({
  id: 'review',
  execute: async ({ context, suspend }) => {
    await suspend({
      reason: 'マネージャーの承認が必要です',
      requestedBy: context.user,
    });
    return { reviewed: true };
  },
});
```

### 関連 \{#related\}

* [ワークフローの一時停止と再開](/docs/examples/workflows_legacy/suspend-and-resume)
* [.resume()](./resume)
* [.watch()](./watch)