---
title: "リファレンス: コンテキスト関連度スコアラー"
description: Mastra のコンテキスト関連度スコアラーに関するドキュメント。重み付き関連度スコアリングにより、エージェントの応答生成に対して提供されたコンテキストの関連性と有用性を評価します。
---

# コンテキスト関連性スコアラー \{#context-relevance-scorer\}

`createContextRelevanceScorerLLM()` 関数は、エージェントの応答の生成にあたって、提供されたコンテキストがどの程度関連性が高く有用だったかを評価するスコアラーを作成します。重み付きの関連性レベルを用い、高い関連性のコンテキストが未使用だった場合や、必要な情報が欠落している場合にペナルティを適用します。

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "MastraLanguageModel",
description: "コンテキストの関連性を評価するために使用する言語モデル",
required: true,
},
{
name: "options",
type: "ContextRelevanceOptions",
description: "スコアラーの設定オプション",
required: true,
children: [
{
name: "context",
type: "string[]",
description: "関連性を評価するコンテキスト断片の配列",
required: false,
},
{
name: "contextExtractor",
type: "(input, output) => string[]",
description: "実行時の入力と出力から動的にコンテキストを抽出する関数",
required: false,
},
{
name: "scale",
type: "number",
description: "最終スコアに乗じるスケール係数（既定: 1）",
required: false,
},
{
name: "penalties",
type: "object",
description: "スコアリング用のカスタマイズ可能なペナルティ設定",
required: false,
children: [
{
name: "unusedHighRelevanceContext",
type: "number",
description: "未使用の高関連コンテキスト1件あたりのペナルティ（既定: 0.1）",
required: false,
},
{
name: "missingContextPerItem",
type: "number",
description: "不足しているコンテキスト項目1件あたりのペナルティ（既定: 0.15）",
required: false,
},
{
name: "maxMissingContextPenalty",
type: "number",
description: "不足コンテキストに対する合計ペナルティの上限（既定: 0.5）",
required: false,
},
],
},
],
},
]}
/>

:::note
`context` または `contextExtractor` のいずれかを指定する必要があります。両方を指定した場合は `contextExtractor` が優先されます。
:::

## .run() の戻り値 \{#run-returns\}

<PropertiesTable
  content={[
{
name: "score",
type: "number",
description: "0 から scale（既定では 0～1）までの重み付き関連度スコア",
},
{
name: "reason",
type: "string",
description: "コンテキストの関連性評価に関する人間が読める説明",
},
]}
/>

## スコア詳細 \{#scoring-details\}

### 重み付き関連度スコアリング \{#weighted-relevance-scoring\}

Context Relevance は、次の点を考慮する高度なスコアリングアルゴリズムを使用します:

1. **関連度レベル**: 各コンテキスト要素は重み付きの値で分類されます:
   * `high` = 1.0（クエリに直接対応）
   * `medium` = 0.7（補助的な情報）
   * `low` = 0.3（間接的・周辺的な関連）
   * `none` = 0.0（完全に無関係）

2. **使用状況の検出**: 関連するコンテキストが実際に回答で使用されたかを追跡

3. **適用されるペナルティ**（`penalties` オプションで設定可能）:
   * **未使用の高関連度**: 未使用の高関連度コンテキストごとに `unusedHighRelevanceContext` のペナルティ（デフォルト: 0.1）
   * **不足コンテキスト**: 特定された不足情報に対して最大 `maxMissingContextPenalty`（デフォルト: 0.5）

### スコア算定式 \{#scoring-formula\}

```
基本スコア = Σ(relevance_weights) / (num_contexts × 1.0)
使用ペナルティ = count(unused_high_relevance) × unusedHighRelevanceContext
欠落ペナルティ = min(count(missing_context) × missingContextPerItem, maxMissingContextPenalty)

最終スコア = max(0, 基本スコア - 使用ペナルティ - 欠落ペナルティ) × scale
```

**デフォルト値**:

* `unusedHighRelevanceContext` = 0.1（未使用の高関連コンテキスト1件につき10%の減点）
* `missingContextPerItem` = 0.15（不足しているコンテキスト項目1件につき15%の減点）
* `maxMissingContextPenalty` = 0.5（不足コンテキストに対する減点は最大50%）
* `scale` = 1

### スコアの解釈 \{#score-interpretation\}

* **0.9-1.0** = ごくわずかな抜けのみで、関連性は非常に高い
* **0.7-0.8** = 一部に未使用または不足する文脈はあるが、関連性は良好
* **0.4-0.6** = 重要な抜けがあり、関連性はまちまち
* **0.0-0.3** = 関連性が低い、または文脈の多くが無関係

### Context Precision との違い \{#difference-from-context-precision\}

| 側面          | Context Relevance                       | Context Precision                  |
| ------------- | --------------------------------------- | ---------------------------------- |
| **アルゴリズム** | 重み付きレベル＋ペナルティ                  | 平均適合率（MAP）                    |
| **関連度**      | 複数レベル（高／中／低／なし）               | 二値（はい／いいえ）                 |
| **位置**       | 考慮しない                                 | 重要（上位にあるほど高評価）           |
| **使用状況**    | 未使用のコンテキストを追跡して減点           | 考慮しない                           |
| **欠落**       | 抜けを特定して減点                         | 評価しない                           |

## 使い方の例 \{#usage-examples\}

### 基本設定 \{#basic-configuration\}

```typescript
const scorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o'),
  options: {
    context: ['アインシュタインは光電効果に関する業績によりノーベル賞を受賞した'],
    scale: 1,
  },
});
```

### カスタムペナルティの設定 \{#custom-penalty-configuration\}

```typescript
const scorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o'),
  options: {
    context: ['Context information...'],
    penalties: {
      unusedHighRelevanceContext: 0.05, // 高関連度なのに未使用のコンテキストへのペナルティを低めにする
      missingContextPerItem: 0.2, // 欠落している項目1つあたりのペナルティを高めにする
      maxMissingContextPenalty: 0.4, // ペナルティの上限値を低めに設定
    },
    scale: 2, // 最終スコアを2倍にする
  },
});
```

### 動的なコンテキスト抽出 \{#dynamic-context-extraction\}

```typescript
const scorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o'),
  options: {
    contextExtractor: (input, output) => {
      // クエリに基づいてコンテキストを抽出
      const userQuery = input?.inputMessages?.[0]?.content || '';
      if (userQuery.includes('Einstein')) {
        return ['アインシュタインは光電効果でノーベル賞を受賞した', '彼は相対性理論を提唱した'];
      }
      return ['物理学に関する一般情報'];
    },
    penalties: {
      unusedHighRelevanceContext: 0.15,
    },
  },
});
```

## 利用パターン \{#usage-patterns\}

### コンテンツ生成の評価 \{#content-generation-evaluation\}

以下のような場面でのコンテキスト品質評価に最適:

* コンテキストの活用が重要なチャットシステム
* 微妙な関連性の判断が求められる RAG パイプライン
* コンテキストの欠落が品質に影響するシステム

### コンテキスト選択の最適化 \{#context-selection-optimization\}

次の目的で使用します:

* コンテキストを網羅的にカバーする
* コンテキストを効果的に活用する
* コンテキストの抜けや不足を見つける

## 関連 \{#related\}

* [Context Precision Scorer](/docs/reference/scorers/context-precision) - MAP を用いてコンテキストのランキングを評価します
* [Faithfulness Scorer](/docs/reference/scorers/faithfulness) - コンテキストに対する回答の根拠の確かさを測定します
* [Custom Scorers](/docs/scorers/custom-scorers) - 独自の評価指標を作成します