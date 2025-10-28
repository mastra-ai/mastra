---
title: "リファレンス: Context Precision Scorer"
description: Mastra における Context Precision Scorer のドキュメント。Mean Average Precision を用いて、想定する出力の生成に向けて取得されたコンテキストの関連性と精度を評価します。
---

# コンテキスト精度スコアラー \{#context-precision-scorer\}

`createContextPrecisionScorer()` 関数は、取得したコンテキスト片が期待される出力の生成にどれだけ関連し、どの程度適切に並べられているかを評価するスコアラーを作成します。これは、関連するコンテキストをシーケンスの先頭付近に配置するシステムに報酬を与えるため、**平均適合率（MAP）** を用います。

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
type: "ContextPrecisionMetricOptions",
description: "スコアラーの設定オプション",
required: true,
children: [
{
name: "context",
type: "string[]",
description: "関連性を評価する対象となるコンテキスト断片の配列",
required: false,
},
{
name: "contextExtractor",
type: "(input, output) => string[]",
description: "実行時の入力と出力からコンテキストを動的に抽出する関数",
required: false,
},
{
name: "scale",
type: "number",
description: "最終スコアに乗算するスケール係数（既定値: 1）",
required: false,
},
],
},
]}
/>

:::note
`context` または `contextExtractor` のいずれかを指定する必要があります。両方を指定した場合は、`contextExtractor` が優先されます。
:::

## .run() の返り値 \{#run-returns\}

<PropertiesTable
  content={[
{
name: "score",
type: "number",
description: "0 から scale（既定では 0～1）までの平均適合率（Mean Average Precision）のスコア",
},
{
name: "reason",
type: "string",
description: "コンテキストの精度評価に関する人間が読める説明",
},
]}
/>

## スコア詳細 \{#scoring-details\}

### 平均適合率（MAP） \{#mean-average-precision-map\}

Context Precision は、関連性と順位の両方を評価するために**平均適合率**を用います：

1. **コンテキストの評価**：各コンテキストが期待される出力の生成に対して関連あり／なしで分類される
2. **適合率の計算**：位置 `i` にある各関連コンテキストについて、precision = `relevant_items_so_far / (i + 1)`
3. **平均適合率**：すべての適合率の値を合計し、関連項目の総数で割る
4. **最終スコア**：スケール係数を掛け、小数点以下2桁に丸める

### スコア算出式 \{#scoring-formula\}

```
MAP = (Σ 適合率@k) / R

定義:
- 適合率@k = (位置 1...k にある関連アイテム数) / k
- R = 関連アイテムの総数
- 関連アイテムが現れる位置でのみ計算
```

### スコアの解釈 \{#score-interpretation\}

* **1.0** = 完全に的確（関連する文脈がすべて先頭に提示される）
* **0.5-0.9** = 一部の関連文脈が適切に配置された良好な的確さ
* **0.1-0.4** = 関連文脈が埋もれている、または散在している低い的確さ
* **0.0** = 関連する文脈が見つからない

### 計算例 \{#example-calculation\}

与えられたコンテキスト: `[relevant, irrelevant, relevant, irrelevant]`

* 位置 0: Relevant → 適合率 = 1/1 = 1.0
* 位置 1: スキップ（irrelevant）
* 位置 2: Relevant → 適合率 = 2/3 = 0.67
* 位置 3: スキップ（irrelevant）

MAP = (1.0 + 0.67) / 2 = 0.835 ≈ **0.83**

## 使い方のパターン \{#usage-patterns\}

### RAGシステムの評価 \{#rag-system-evaluation\}

次のようなRAGパイプラインで、取得したコンテキストの評価に最適です:

* モデル性能においてコンテキストの順序が重要な場合
* 単なる関連性評価を超えて検索（リトリーバル）品質を測定する必要がある場合
* 後から得られる関連コンテキストよりも、先に得られる関連コンテキストのほうが価値が高い場合

### コンテキストウィンドウの最適化 \{#context-window-optimization\}

次のケースでコンテキスト選択を最適化する際に使用します:

* 限られたコンテキストウィンドウ
* トークン予算の制約
* 複数段階の推論タスク

## 関連 \{#related\}

* [Answer Relevancy Scorer](/docs/reference/scorers/answer-relevancy) - 回答が質問に適切に答えているかを評価
* [Faithfulness Scorer](/docs/reference/scorers/faithfulness) - 文脈に対する回答の根拠の確かさを測定
* [Custom Scorers](/docs/scorers/custom-scorers) - 独自の評価指標を作成