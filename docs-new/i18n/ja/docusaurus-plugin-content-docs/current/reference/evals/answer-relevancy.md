---
title: "リファレンス: Answer Relevancy"
description: Mastra における Answer Relevancy 指標のドキュメント。LLM の出力が入力クエリにどの程度関連しているかを評価します。
---

# AnswerRelevancyMetric \{#answerrelevancymetric\}

:::info New Scorer API

より扱いやすい API、エラー分析のためのより豊富なメタデータの保存、そしてデータ構造を柔軟に評価できる新しい評価 API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`AnswerRelevancyMetric` クラスは、LLM の出力が入力クエリにどれだけ適切に答えているか・対応しているかを評価します。判定者ベースの方式で関連性を判定し、詳細なスコアと根拠を提示します。

## 基本的な使い方 \{#basic-usage\}

```typescript
import { openai } from '@ai-sdk/openai';
import { AnswerRelevancyMetric } from '@mastra/evals/llm';

// 評価用のモデルを構成
const model = openai('gpt-4o-mini');

const metric = new AnswerRelevancyMetric(model, {
  uncertaintyWeight: 0.3,
  scale: 1,
});

const result = await metric.measure('フランスの首都はどこですか？', 'フランスの首都はパリです。');

console.log(result.score); // 0〜1のスコア
console.log(result.info.reason); // スコアの説明
```

## コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "LanguageModel",
description: "関連性評価に使用するモデルの構成",
isOptional: false,
},
{
name: "options",
type: "AnswerRelevancyMetricOptions",
description: "指標の構成オプション",
isOptional: true,
defaultValue: "{ uncertaintyWeight: 0.3, scale: 1 }",
},
]}
/>

### AnswerRelevancyMetricOptions \{#answerrelevancymetricoptions\}

<PropertiesTable
  content={[
{
name: "uncertaintyWeight",
type: "number",
description: "スコア算出において「不確か（unsure）」判定に与える重み（0〜1）",
isOptional: true,
defaultValue: "0.3",
},
{
name: "scale",
type: "number",
description: "スコアの最大値",
isOptional: true,
defaultValue: "1",
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

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "score",
type: "number",
description: "関連度スコア（0 からのスケール。デフォルトは 0〜1）",
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
description: "スコアの説明",
},
],
},
],
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

この指標は、完全性、正確性、詳細度を考慮し、クエリと回答の整合性に基づいて関連性を評価します。

### スコアリングプロセス \{#scoring-process\}

1. ステートメントの分析:
   * 文脈を保ったまま、出力を意味のあるステートメントに分割する
   * 各ステートメントをクエリの要件に照らして評価する

2. 各ステートメントの関連性を評価:
   * &quot;yes&quot;: 直接一致に対して満額の重みを付与
   * &quot;unsure&quot;: おおよそ一致に対して部分的な重みを付与（既定値: 0.3）
   * &quot;no&quot;: 無関係な内容には重みを付与しない

最終スコア: `((direct + uncertainty * partial) / total_statements) * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から、デフォルトは0〜1）

* 1.0: 完全に関連性が高い — 完全かつ正確
* 0.7〜0.9: 高い関連性 — 軽微な欠落や不正確さ
* 0.4〜0.6: 中程度の関連性 — 目立つ欠落あり
* 0.1〜0.3: 低い関連性 — 重大な問題あり
* 0.0: 関連性なし — 誤りまたは的外れ

## カスタム設定の例 \{#example-with-custom-configuration\}

```typescript
import { openai } from '@ai-sdk/openai';
import { AnswerRelevancyMetric } from '@mastra/evals/llm';

// 評価用にモデルを設定する
const model = openai('gpt-4o-mini');

const metric = new AnswerRelevancyMetric(model, {
  uncertaintyWeight: 0.5, // 判断が不確かな場合の重みを高める
  scale: 5, // 0–1 の代わりに 0–5 のスケールを使用
});

const result = await metric.measure(
  '運動にはどんな利点がありますか？',
  '定期的な運動は心血管の健康を高め、筋力を向上させ、メンタルヘルスにも良い影響を与えます。',
);

// 出力例:
// {
//   score: 4.5,
//   info: {
//     reason: "スコアが 5 点中 4.5 であるのは、回答が質問に直接対応し、
//           運動の具体的で正確な利点を挙げているからです。複数の側面
//           （心血管、筋力、メンタルヘルス）を明確かつ簡潔にカバーしています。
//           回答は関連性が非常に高く、不要な情報を含めずに適切な詳細を提供しています。"
//           including unnecessary information."
//   }
// }
```

## 関連項目 \{#related\}

* [プロンプト整合性メトリック](./prompt-alignment)
* [コンテキスト適合度メトリック](./context-precision)
* [忠実性メトリック](./faithfulness)