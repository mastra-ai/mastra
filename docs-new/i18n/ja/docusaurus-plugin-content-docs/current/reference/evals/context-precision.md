---
title: "リファレンス: Context Precision"
description: Mastra における Context Precision 指標のドキュメント。期待される出力の生成に向けて取得されたコンテキストノードの関連性と精度を評価します。
---

# ContextPrecisionMetric \{#contextprecisionmetric\}

:::info 新しい Scorer API

使いやすい API、エラー分析のためのより豊富なメタデータ、そしてデータ構造を柔軟に評価できる新しい評価用 API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`ContextPrecisionMetric` クラスは、期待される出力を生成するうえで取得されたコンテキストノードがどれほど関連性が高く、的確であるかを評価します。各コンテキスト要素の寄与度を判定ベースで分析し、位置に応じた重み付きスコアを付与します。

## 基本的な使い方 \{#basic-usage\}

```typescript
import { openai } from '@ai-sdk/openai';
import { ContextPrecisionMetric } from '@mastra/evals/llm';

// 評価用のモデルを設定
const model = openai('gpt-4o-mini');

const metric = new ContextPrecisionMetric(model, {
  context: [
    '光合成は、植物が太陽光からエネルギーを生成するために使用する生物学的プロセスです。',
    '植物は成長するために土壌から水分と栄養素を必要とします。',
    '光合成のプロセスは副産物として酸素を生成します。',
  ],
});

const result = await metric.measure(
  '光合成とは何ですか?',
  '光合成は、植物が太陽光をエネルギーに変換するプロセスです。',
);

console.log(result.score); // 0から1までの精度スコア
console.log(result.info.reason); // スコアの説明
```

## コンストラクタのパラメーター \{#constructor-parameters\}

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
type: "ContextPrecisionMetricOptions",
description: "このメトリクスの設定オプション",
isOptional: false,
},
]}
/>

### ContextPrecisionMetricOptions \{#contextprecisionmetricoptions\}

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
description: "取得順のコンテキスト片の配列",
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
description: "評価対象の生成された応答",
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
description: "精度スコア（0〜scale、デフォルトは 0〜1）",
},
{
name: "info",
type: "object",
description: "スコアの理由を含むオブジェクト",
properties: [
{
type: "string",
parameters: [
{
name: "reason",
type: "string",
description: "スコアの詳細な説明",
},
],
},
],
},
]}
/>

## スコアの詳細 \{#scoring-details\}

この指標は、二値の関連性評価と Mean Average Precision（MAP）に基づくスコアリングで、コンテキストの正確さを評価します。

### スコアリングプロセス \{#scoring-process\}

1. 二値の関連度スコアを割り当てる:
   * 関連するコンテキスト: 1
   * 関連しないコンテキスト: 0

2. 平均適合率（Mean Average Precision）を計算する:
   * 各順位での適合率を算出
   * 上位の順位をより重く評価
   * 設定されたスケールに正規化

最終スコア: `Mean Average Precision * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から。デフォルトは0～1）

* 1.0: 関連する文脈がすべて最適な順序で並んでいる
* 0.7～0.9: ほとんどが関連する文脈で、順序も良好
* 0.4～0.6: 関連性が混在、または順序が最適でない
* 0.1～0.3: 関連性が限定的、または順序が不十分
* 0.0: 関連する文脈がない

## 分析付きの例 \{#example-with-analysis\}

```typescript
import { openai } from '@ai-sdk/openai';
import { ContextPrecisionMetric } from '@mastra/evals/llm';

// 評価用のモデルを設定
const model = openai('gpt-4o-mini');

const metric = new ContextPrecisionMetric(model, {
  context: [
    '運動は心臓を強化し、血液循環を改善します。',
    'バランスの取れた食事は健康にとって重要です。',
    '定期的な身体活動はストレスや不安を軽減します。',
    '運動器具は高価になることがあります。',
  ],
});

const result = await metric.measure(
  '運動の効果は何ですか?',
  '定期的な運動は心血管の健康とメンタルヘルスを改善します。',
);

// 出力例:
// {
//   score: 0.75,
//   info: {
//     reason: "スコアが0.75なのは、1番目と3番目のコンテキストが出力で言及されている
//           効果と高い関連性があるのに対し、2番目と4番目のコンテキストは
//           運動の効果と直接関係していないためです。関連性のあるコンテキストは
//           シーケンスの最初と中間に適切に配置されています。"
//   }
// }
```

## 関連項目 \{#related\}

* [回答関連性メトリック](./answer-relevancy)
* [コンテキスト位置メトリック](./context-position)
* [完全性メトリック](./completeness)
* [コンテキスト関連性メトリック](./context-relevancy)