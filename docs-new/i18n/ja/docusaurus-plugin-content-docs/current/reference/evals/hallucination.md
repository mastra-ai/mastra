---
title: "リファレンス: Hallucination"
description: Mastra の Hallucination 指標に関するドキュメント。提供されたコンテキストとの矛盾を検出することで、LLM 出力の事実的正確性を評価します。
---

# HallucinationMetric \{#hallucinationmetric\}

:::info 新しい Scorer API

より扱いやすい API、エラー分析のための追加メタデータ、データ構造の評価における柔軟性を備えた新しい評価用 API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`HallucinationMetric` は、LLM の出力を提供されたコンテキストと照合して、事実に即した正確な情報を生成しているかを評価します。この指標は、コンテキストと出力間の明確な矛盾を特定することでハルシネーションを測定します。

## 基本的な使い方 \{#basic-usage\}

```typescript
import { openai } from '@ai-sdk/openai';
import { HallucinationMetric } from '@mastra/evals/llm';

// 評価用にモデルを設定する
const model = openai('gpt-4o-mini');

const metric = new HallucinationMetric(model, {
  context: ['Tesla は 2003 年に California 州 San Carlos で Martin Eberhard と Marc Tarpenning によって設立されました。'],
});

const result = await metric.measure(
  "Tesla の創業について教えてください。",
  'Tesla は 2004 年に California で Elon Musk によって設立されました。',
);

console.log(result.score); // スコア（0〜1）
console.log(result.info.reason); // スコアの説明

// 出力例:
// {
//   score: 0.67,
//   info: {
//     reason: "スコアが 0.67 である理由は、コンテキスト中の 3 つの記述のうち 2 つ
//           （創業年と創業者）が出力と矛盾しており、
//           場所に関する記述は矛盾していないためです。"
//   }
// }
```

## コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "LanguageModel",
description: "幻覚（Hallucination）評価に使用するモデルの設定",
isOptional: false,
},
{
name: "options",
type: "HallucinationMetricOptions",
description: "メトリクスの設定オプション",
isOptional: false,
},
]}
/>

### HallucinationMetricOptions \{#hallucinationmetricoptions\}

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
description: "正解（ソース・オブ・トゥルース）として使用するコンテキストの配列",
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
description: "評価対象の LLM の応答",
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
description: "ハルシネーションスコア（0 からスケールの上限まで、既定は 0～1）",
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
description:
"スコアの詳細な説明と、特定された矛盾点",
},
],
},
],
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

この指標は、矛盾の検出と裏付けのない主張の分析を通じて、ハルシネーションを評価します。

### スコアリングプロセス \{#scoring-process\}

1. 事実内容を分析する:
   * 文脈から記述（ステートメント）を抽出する
   * 数値や日付を特定する
   * 記述同士の関係をマッピングする

2. 出力のハルシネーションを分析する:
   * 文脈中の記述と照合する
   * 直接の矛盾をハルシネーションとしてマークする
   * 根拠のない主張をハルシネーションとして特定する
   * 数値の正確性を評価する
   * 近似表現の文脈を考慮する

3. ハルシネーションスコアを算出する:
   * ハルシネーションとなった記述（矛盾や根拠のない主張）を数える
   * 総記述数で割る
   * 設定された範囲にスケールする

最終スコア: `(hallucinated_statements / total_statements) * scale`

### 重要な留意事項 \{#important-considerations\}

* コンテキストにない主張はハルシネーションとして扱う
* 明示的な根拠がない主観的な主張はハルシネーションとみなす
* コンテキスト内の事実に関する推測的表現（“might”“possibly”など）は許容される
* コンテキスト外の事実に関する推測的表現はハルシネーションとして扱う
* 出力が空の場合、ハルシネーションはゼロとなる
* 数値の評価では次を考慮する：
  * スケールに見合った精度
  * コンテキストに即した概算
  * 明示的な精度の指示

### スコアの解釈 \{#score-interpretation\}

（スケールは0から、デフォルトは0〜1）

* 1.0: 完全なハルシネーション - すべてのコンテキスト記述と矛盾
* 0.75: 高度なハルシネーション - コンテキスト記述の75%と矛盾
* 0.5: 中程度のハルシネーション - コンテキスト記述の半数と矛盾
* 0.25: 低度のハルシネーション - コンテキスト記述の25%と矛盾
* 0.0: ハルシネーションなし - 出力がすべてのコンテキスト記述と整合

**注:** スコアはハルシネーションの程度を示します。スコアが低いほど、与えられたコンテキストとの事実整合性が高くなります

## 解説付きの例 \{#example-with-analysis\}

```typescript
import { openai } from '@ai-sdk/openai';
import { HallucinationMetric } from '@mastra/evals/llm';

// 評価用にモデルを設定する
const model = openai('gpt-4o-mini');

const metric = new HallucinationMetric(model, {
  context: [
    'OpenAI は 2015 年 12 月に Sam Altman、Greg Brockman らによって設立されました。',
    '同社は 10 億ドルの出資コミットメントとともに始動しました。',
    'Elon Musk は初期の支援者でしたが、2018 年に取締役を退任しました。',
  ],
});

const result = await metric.measure({
  input: 'OpenAI に関する主要なポイントは何ですか？',
  output: 'OpenAI は 2015 年に Elon Musk と Sam Altman によって、20 億ドルの投資で設立されました。',
});

// 出力例:
// {
//   score: 0.33,
//   info: {
//     reason: "スコアが 0.33 なのは、コンテキストの 3 つの記述のうち 1 つが
//           矛盾していたためです（投資額が 10 億ドルではなく 20 億ドルと記載されていたため）。
//           設立年は正しかった一方、創業者の記述は不完全ではあるものの、
//           厳密には矛盾していませんでした。"
//   }
// }
```

## 関連 \{#related\}

* [忠実度メトリクス](./faithfulness)
* [解答関連性メトリクス](./answer-relevancy)
* [文脈精度メトリクス](./context-precision)
* [文脈関連性メトリクス](./context-relevancy)