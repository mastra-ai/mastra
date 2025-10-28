---
title: '.after() '
description: ワークフロー（レガシー）での `after()` メソッドのドキュメント。分岐やマージの経路を構成できます。
---

# .after() \{#after\}

`.after()` メソッドは、ワークフロー内のステップ間に明示的な依存関係を定義し、ワークフローの実行において分岐や結合の経路を可能にします。

## 使い方 \{#usage\}

### 基本的なブランチ操作 \{#basic-branching\}

```typescript
workflow
  .step(stepA)
  .then(stepB)
  .after(stepA) // stepA 完了後に新しいブランチを作成
  .step(stepC);
```

### 複数のブランチを統合する \{#merging-multiple-branches\}

```typescript
workflow
  .step(stepA)
  .then(stepB)
  .step(stepC)
  .then(stepD)
  .after([stepB, stepD]) // 複数のステップに依存するステップを作成する
  .step(stepE);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "steps",
type: "Step | Step[]",
description:
"続行前に完了している必要がある単一のステップ、またはステップの配列",
isOptional: false,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflow",
type: "LegacyWorkflow",
description: "メソッドチェーンに使用するワークフローインスタンス",
},
]}
/>

## 例 \{#examples\}

### 依存関係を1つにする \{#single-dependency\}

```typescript
workflow
  .step(fetchData)
  .then(processData)
  .after(fetchData) // fetchData の後に分岐する
  .step(logData);
```

### 複数の依存関係（ブランチの統合） \{#multiple-dependencies-merging-branches\}

```typescript
workflow
  .step(fetchUserData)
  .then(validateUserData)
  .step(fetchProductData)
  .then(validateProductData)
  .after([validateUserData, validateProductData]) // 両方の検証が完了するのを待つ
  .step(processOrder);
```

## 関連 \{#related\}

* [Branching Paths の例](/docs/examples/workflows_legacy/branching-paths)
* [Workflow クラスリファレンス](./workflow)
* [Step リファレンス](./step-class)
* [制御フローガイド](/docs/examples/workflows_legacy/conditional-branching)