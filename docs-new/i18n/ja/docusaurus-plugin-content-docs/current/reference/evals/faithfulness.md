---
title: "リファレンス: Faithfulness"
description: Mastra の「Faithfulness」メトリクスに関するドキュメント。提供されたコンテキストに照らして、LLM の出力の事実的正確性を評価します。
---

# FaithfulnessMetric リファレンス \{#faithfulnessmetric-reference\}

:::info 新しい Scorer API

より使いやすい API、エラー分析のためのより豊富なメタデータ、そしてデータ構造を柔軟に評価できる新しい評価 API「Scorers」を公開しました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

Mastra の `FaithfulnessMetric` は、LLM の出力が、与えられたコンテキストと比べてどれほど事実に忠実かを評価します。出力から主張を抽出し、それらをコンテキストに照らして検証するため、RAG パイプラインの応答の信頼性を測るうえで不可欠です。

## 基本的な使い方 \{#basic-usage\}

```typescript
import { openai } from '@ai-sdk/openai';
import { FaithfulnessMetric } from '@mastra/evals/llm';

// 評価用のモデルを設定
const model = openai('gpt-4o-mini');

const metric = new FaithfulnessMetric(model, {
  context: ['会社は1995年に設立されました。', '現在約450〜550人を雇用しています。'],
});

const result = await metric.measure(
  '会社について教えてください。',
  '会社は1995年に設立され、500人の従業員がいます。',
);

console.log(result.score); // 1.0
console.log(result.info.reason); // "すべての主張はコンテキストによってサポートされています。"
```

## コンストラクターの引数 \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "LanguageModel",
description: "忠実性を評価するために使用するモデルの設定。",
isOptional: false,
},
{
name: "options",
type: "FaithfulnessMetricOptions",
description: "メトリクスの設定に関する追加オプション。",
isOptional: false,
},
]}
/>

### FaithfulnessMetricOptions \{#faithfulnessmetricoptions\}

<PropertiesTable
  content={[
{
name: "scale",
type: "number",
description:
"スコアの最大値。最終スコアはこの尺度に正規化されます。",
isOptional: false,
defaultValue: "1",
},
{
name: "context",
type: "string[]",
description:
"出力の主張を検証するためのコンテキストチャンクの配列。",
isOptional: false,
},
]}
/>

## measure() のパラメーター \{#measure-parameters\}

<PropertiesTable
  content={[
{
name: "input",
type: "string",
description: "LLM に与えられた元のクエリまたはプロンプト。",
isOptional: false,
},
{
name: "output",
type: "string",
description: "忠実性を評価する対象となる LLM の応答。",
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
description:
"0 から設定スケールの上限までのスコアで、コンテキストによって裏付けられた主張の割合を表します。",
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
"どの主張が裏付けられたか、矛盾したか、または不明と判断されたかを含む、スコアの詳細な説明。",
},
],
},
],
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

この指標は、提供されたコンテキストに照らして主張を検証することで、忠実性を評価します。

### スコアリングプロセス \{#scoring-process\}

1. 事実主張と文脈を分析:
   * すべての主張（事実および推測）を抽出
   * 各主張を文脈と照合して検証
   * 次のいずれかの判定を付与:
     * &quot;yes&quot; - 文脈によって裏付けられる主張
     * &quot;no&quot; - 文脈と矛盾する主張
     * &quot;unsure&quot; - 検証不能な主張

2. 忠実性スコアを算出:
   * 裏付けられた主張の数をカウント
   * 総主張数で割る
   * 設定された範囲にスケーリング

最終スコア: `(supported_claims / total_claims) * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から、既定は0–1）

* 1.0: すべての主張が文脈によって裏付けられている
* 0.7–0.9: ほとんどの主張が裏付けられており、検証不能なものは少数
* 0.4–0.6: 裏付けは混在しており、いくつか矛盾がある
* 0.1–0.3: 裏付けは限定的で、矛盾が多い
* 0.0: 裏付けられた主張はない

## 発展的な例 \{#advanced-example\}

```typescript
import { openai } from '@ai-sdk/openai';
import { FaithfulnessMetric } from '@mastra/evals/llm';

// 評価用にモデルを設定する
const model = openai('gpt-4o-mini');

const metric = new FaithfulnessMetric(model, {
  context: ['その会社は2020年時点で従業員が100人在籍していた。', '現在の従業員数は約500人。'],
});

// 異なるタイプの主張が混在する例
const result = await metric.measure(
  "その会社の成長はどのような状況ですか？",
  'その会社は2020年の従業員100人から現在は500人へと成長しており、来年までに1000人へ拡大する可能性があります。',
);

// 出力例:
// {
//   score: 0.67,
//   info: {
//     reason: "スコアが0.67である理由は、2つの主張（2020年の初期従業員数100人と現在の500人）が文脈により裏付けられている一方で、
//           将来の拡大に関する主張は文脈から検証できないため「不確か」と判断されたためです。"
//           while the future expansion claim is marked as unsure as it cannot
//           be verified against the context."
//   }
// }
```

### 関連項目 \{#related\}

* [回答関連性メトリクス](./answer-relevancy)
* [ハルシネーション・メトリクス](./hallucination)
* [コンテキスト関連性メトリクス](./context-relevancy)