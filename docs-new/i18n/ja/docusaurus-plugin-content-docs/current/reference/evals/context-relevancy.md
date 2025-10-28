---
title: "リファレンス: コンテキスト適合度"
description: RAG パイプラインで取得したコンテキストの適合度を評価する Context Relevancy 指標のドキュメント。
---

# ContextRelevancyMetric \{#contextrelevancymetric\}

:::info 新しい Scorer API

より扱いやすい API に加え、エラー分析向けのメタデータをより多く保存し、データ構造の評価にも柔軟に対応できる新しい evals API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`ContextRelevancyMetric` クラスは、取得したコンテキストが入力クエリにどれほど関連しているかを測定することで、RAG（Retrieval-Augmented Generation）パイプラインにおけるリトリーバの品質を評価します。LLM ベースの評価方式を用いて、まずコンテキストから記述（ステートメント）を抽出し、その後それらの入力への関連性を判定します。

## 基本的な使用方法 \{#basic-usage\}

```typescript
import { openai } from '@ai-sdk/openai';
import { ContextRelevancyMetric } from '@mastra/evals/llm';

// 評価用のモデルを設定
const model = openai('gpt-4o-mini');

const metric = new ContextRelevancyMetric(model, {
  context: [
    'すべてのデータは保存時および転送時に暗号化されます',
    '二要素認証は必須です',
    'プラットフォームは複数の言語をサポートしています',
    '当社のオフィスはサンフランシスコにあります',
  ],
});

const result = await metric.measure(
  '当社製品のセキュリティ機能は何ですか?',
  '当社の製品は暗号化を使用し、二要素認証が必要です。',
);

console.log(result.score); // 0から1のスコア
console.log(result.info.reason); // 関連性評価の説明
```

## コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "LanguageModel",
description:
"コンテキストの関連性を評価するために使用するモデルの設定",
isOptional: false,
},
{
name: "options",
type: "ContextRelevancyMetricOptions",
description: "メトリックの設定オプション",
isOptional: false,
},
]}
/>

### ContextRelevancyMetricOptions \{#contextrelevancymetricoptions\}

<PropertiesTable
  content={[
{
name: "scale",
type: "number",
description: "スコアの最大値",
isOptional: true,
defaultValue: "1",
},
{
name: "context",
type: "string[]",
description:
"応答の生成に用いる取得済みコンテキスト文書の配列",
isOptional: false,
},
]}
/>

## measure() のパラメータ \{#measure-parameters\}

<PropertiesTable
  content={[
{
name: "input",
type: "string",
description: "元のクエリまたはプロンプト",
isOptional: false,
},
{
name: "output",
type: "string",
description: "評価対象のLLMの応答",
isOptional: false,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "score",
type: "number",
description: "コンテキスト関連度スコア（0 から最大値まで。既定は 0～1）",
},
{
name: "info",
type: "object",
description: "スコアの根拠を含むオブジェクト",
properties: [
{
type: "string",
parameters: [
{
name: "reason",
type: "string",
description: "関連度評価の詳細な説明",
},
],
},
],
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

このメトリクスは、取得したコンテキストがクエリにどれほど適合しているかを、二値の関連性分類で評価します。

### スコアリング手順 \{#scoring-process\}

1. コンテキストから文（ステートメント）を抽出:
   * コンテキストを意味のある単位に分割
   * 意味的な関係性を保持

2. 文（ステートメント）の関連性を評価:
   * 各文をクエリに対して評価
   * 関連する文の数を集計
   * 関連度の比率を算出

最終スコア: `(relevant_statements / total_statements) * scale`

### スコアの解釈 \{#score-interpretation\}

（範囲は0から、既定は0〜1）

* 1.0: 完全に高い関連性 - 取得されたコンテキストはすべて関連している
* 0.7〜0.9: 高い関連性 - ほとんどのコンテキストが関連しており、無関係なものは少ない
* 0.4〜0.6: 中程度の関連性 - 関連・無関係のコンテキストが混在している
* 0.1〜0.3: 低い関連性 - ほとんどが無関係なコンテキスト
* 0.0: 関連性なし - 完全に無関係なコンテキスト

## カスタム設定の例 \{#example-with-custom-configuration\}

```typescript
import { openai } from '@ai-sdk/openai';
import { ContextRelevancyMetric } from '@mastra/evals/llm';

// 評価用のモデルを設定
const model = openai('gpt-4o-mini');

const metric = new ContextRelevancyMetric(model, {
  scale: 100, // 0〜1 ではなく 0〜100 のスケールを使用
  context: [
    'ベーシックプランは月額 $10 です',
    'プロプランは高度な機能を含み、月額 $30 です',
    'エンタープライズプランはカスタム価格です',
    '当社は2020年に設立されました',
    '当社は世界各地にオフィスがあります',
  ],
});

const result = await metric.measure('当社の料金プランは何ですか？', 'ベーシック、プロ、エンタープライズの各プランを提供しています。');

// 出力例:
// {
//   score: 60,
//   info: {
//     reason: "5件中3件の記述が料金プランに関連しています。以下の記述は
//           会社の設立とオフィス所在地に関するもので、料金に関する質問には関連しません。"
//   }
// }
```

## 関連 \{#related\}

* [コンテキスト再現率](./contextual-recall)
* [コンテキスト適合率](./context-precision)
* [コンテキスト位置](./context-position)