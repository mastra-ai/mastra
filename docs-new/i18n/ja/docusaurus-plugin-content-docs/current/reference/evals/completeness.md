---
title: "リファレンス：Completeness"
description: Mastra の Completeness メトリクスに関するドキュメント。入力に含まれる重要な要素が LLM の出力でどの程度カバーされているかを評価します。
---

# CompletenessMetric \{#completenessmetric\}

:::info 新しい Scorer API

より扱いやすい API、エラー分析のためのより豊富なメタデータ、データ構造を評価するための柔軟性を備えた、Scorers という新しい evals API をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`CompletenessMetric` クラスは、LLM の出力が入力内の主要な要素をどれだけ網羅しているかを評価します。名詞、動詞、トピック、用語を分析してカバレッジを判定し、詳細な網羅性スコアを提供します。

## 基本的な使い方 \{#basic-usage\}

```typescript
import { CompletenessMetric } from '@mastra/evals/nlp';

const metric = new CompletenessMetric();

const result = await metric.measure(
  '太陽光、水、二酸化炭素を使って、植物の光合成がどのように働くかを説明してください。',
  '植物は太陽光を利用し、水と二酸化炭素から光合成によってグルコースを生成します。',
);

console.log(result.score); // カバレッジスコア（0～1）
console.log(result.info); // 要素カバレッジに関する詳細な指標を含むオブジェクト
```

## measure() のパラメータ \{#measure-parameters\}

<PropertiesTable
  content={[
{
name: "input",
type: "string",
description: "網羅すべき主要要素を含む元のテキスト",
isOptional: false,
},
{
name: "output",
type: "string",
description: "網羅性を評価するための LLM の応答",
isOptional: false,
},
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "score",
type: "number",
description:
"出力でカバーされた入力要素の割合を示す完全性スコア（0〜1）",
},
{
name: "info",
type: "object",
description: "要素カバレッジに関する詳細な指標を含むオブジェクト",
properties: [
{
type: "string[]",
parameters: [
{
name: "inputElements",
type: "string[]",
description: "入力から抽出された主要要素の配列",
},
],
},
{
type: "string[]",
parameters: [
{
name: "outputElements",
type: "string[]",
description: "出力で検出された主要要素の配列",
},
],
},
{
type: "string[]",
parameters: [
{
name: "missingElements",
type: "string[]",
description: "出力で見つからなかった入力要素の配列",
},
],
},
{
type: "object",
parameters: [
{
name: "elementCounts",
type: "object",
description: "入力および出力に含まれる要素数",
},
],
},
],
},
]}
/>

## 要素抽出の詳細 \{#element-extraction-details\}

この指標は複数の種類の要素を抽出・分析します:

* 名詞: 主要な対象、概念、エンティティ
* 動詞: 行為や状態（不定形に正規化）
* トピック: 主題・テーマ
* 用語: 個々の重要語

抽出プロセスには次が含まれます:

* テキストの正規化（ダイアクリティクスの除去、小文字化）
* camelCase の単語の分割
* 単語境界の処理
* 短い単語（3文字以下）の特別な扱い
* 要素の重複排除

## スコアリングの詳細 \{#scoring-details\}

このメトリックは、言語要素のカバレッジ分析を通じて網羅性を評価します。

### スコアリング手順 \{#scoring-process\}

1. 主要要素を抽出:
   * 名詞と固有表現（固有名詞）
   * 主要な動詞
   * トピック特有の用語
   * 正規化した語形

2. 入力要素のカバー率を算出:
   * 短い用語（≤3文字）は完全一致
   * 長い用語は大きな重なり（&gt;60%）

最終スコア: `(covered_elements / total_input_elements) * scale`

### スコアの解釈 \{#score-interpretation\}

（範囲は0から。既定は0～1）

* 1.0: 完全に網羅 — 入力要素をすべて含む
* 0.7～0.9: 高い網羅性 — 主要要素の大半を含む
* 0.4～0.6: 部分的な網羅性 — 一部の主要要素を含む
* 0.1～0.3: 低い網羅性 — 主要要素のほとんどが欠落
* 0.0: 網羅なし — 出力に入力要素がまったく含まれていない

## 解析付きの例 \{#example-with-analysis\}

```typescript
import { CompletenessMetric } from '@mastra/evals/nlp';

const metric = new CompletenessMetric();

const result = await metric.measure('素早い茶色の狐が怠け者の犬を飛び越える', '茶色の狐が犬を飛び越えた');

// 出力例:
// {
//   score: 0.75,
//   info: {
//     inputElements: ["quick", "brown", "fox", "jump", "lazy", "dog"],
//     outputElements: ["brown", "fox", "jump", "dog"],
//     missingElements: ["quick", "lazy"],
//     elementCounts: { input: 6, output: 4 }
//   }
// }
```

## 関連項目 \{#related\}

* [回答関連性メトリクス](./answer-relevancy)
* [コンテンツ類似度メトリクス](./content-similarity)
* [テキスト差分メトリクス](./textual-difference)
* [キーワード網羅率メトリクス](./keyword-coverage)