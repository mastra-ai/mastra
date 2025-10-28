---
title: "リファレンス：要約"
description: Mastra の要約評価指標に関するドキュメント。LLM が生成した要約の内容品質と事実正確性を評価します。
---

# SummarizationMetric \{#summarizationmetric\}

:::info New Scorer API

新しい評価用API「Scorers」をリリースしました。より扱いやすいAPI設計、エラー分析に役立つより豊富なメタデータの保存、そしてデータ構造を柔軟に評価できる機能を備えています。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`SummarizationMetric` は、LLM の要約が元のテキストの内容を的確に捉えつつ、事実関係の正確さを維持できているかを評価します。アラインメント（事実の正確性）とカバレッジ（重要情報の網羅）という2つの側面を組み合わせ、いずれも満たされていることを保証するため、両者のうち低い方のスコアを用いて判定します。

## 基本的な使い方 \{#basic-usage\}

```typescript
import { openai } from '@ai-sdk/openai';
import { SummarizationMetric } from '@mastra/evals/llm';

// 評価用にモデルを設定する
const model = openai('gpt-4o-mini');

const metric = new SummarizationMetric(model);

const result = await metric.measure(
  'その会社は1995年にJohn Smithによって設立された。従業員は10人で始まり、2020年までに500人に増えた。同社の本社はシアトルにある。',
  '1995年にJohn Smithによって設立され、同社は従業員数が10人から2020年までに500人へと増加した。',
);

console.log(result.score); // スコア（0〜1）
console.log(result.info); // 要約に関する詳細な評価指標を含むオブジェクト
```

## コンストラクターの引数 \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "LanguageModel",
description: "要約の評価に使用するモデルの設定",
isOptional: false,
},
{
name: "options",
type: "SummarizationMetricOptions",
description: "メトリクスの設定オプション",
isOptional: true,
defaultValue: "{ scale: 1 }",
},
]}
/>

### SummarizationMetricOptions \{#summarizationmetricoptions\}

<PropertiesTable
  content={[
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
description: "要約対象の元テキスト",
isOptional: false,
},
{
name: "output",
type: "string",
description: "評価対象の生成要約",
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
description: "要約スコア（0 から上限まで、既定では 0～1）",
},
{
name: "info",
type: "object",
description: "要約に関する詳細な指標を含むオブジェクト",
properties: [
{
type: "string",
parameters: [
{
name: "reason",
type: "string",
description:
"スコアの詳細な説明（整合性と網羅性の両面を含む）",
},
],
},
{
type: "number",
parameters: [
{
name: "alignmentScore",
type: "number",
description: "整合性スコア（0～1）",
},
],
},
{
type: "number",
parameters: [
{
name: "coverageScore",
type: "number",
description: "網羅性スコア（0～1）",
},
],
},
],
},
]}
/>

## 採点の詳細 \{#scoring-details\}

この指標は、次の2つの主要要素で要約を評価します:

1. **アラインメントスコア**: 事実関係の正確さを測定
   * 要約から主張を抽出
   * 各主張を原文と照合して検証
   * 「yes」「no」「unsure」のいずれかの判定を付与

2. **カバレッジスコア**: 重要情報の網羅状況を測定
   * 原文から重要な質問を生成
   * 要約がこれらの質問に答えているかを確認
   * 情報の包含と網羅性を評価

### スコアリング手順 \{#scoring-process\}

1. アラインメントスコアを算出:
   * 要約から主張を抽出
   * 原文に照らして検証
   * 次を計算: `supported_claims / total_claims`

2. カバレッジスコアを算出:
   * 原文から質問を生成
   * 要約内で回答の有無を確認
   * 網羅性を評価
   * 次を計算: `answerable_questions / total_questions`

最終スコア: `min(alignment_score, coverage_score) * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から、既定は0〜1）

* 1.0: 完璧な要約 - 事実に完全に即し、重要情報をすべて網羅
* 0.7-0.9: 良質な要約だが、軽微な抜けやわずかな不正確さがある
* 0.4-0.6: 中程度の品質で、目立つ抜けや不正確さがある
* 0.1-0.3: 質の低い要約で、大きな抜けや事実誤りがある
* 0.0: 無効な要約 - まったく不正確、または重要情報が欠落している

## 分析付きの例 \{#example-with-analysis\}

```typescript
import { openai } from '@ai-sdk/openai';
import { SummarizationMetric } from '@mastra/evals/llm';

// 評価用のモデルを設定
const model = openai('gpt-4o-mini');

const metric = new SummarizationMetric(model);

const result = await metric.measure(
  "電気自動車会社Teslaは、2003年にMartin EberhardとMarc Tarpenningによって設立されました。Elon Muskは2004年に最大の投資家として参加し、2008年にCEOに就任しました。同社初の車であるRoadsterは2008年に発売されました。",
  'Teslaは2003年にElon Muskによって設立され、2008年のRoadsterを皮切りに電気自動車業界に革命をもたらしました。',
);

// 出力例:
// {
//   score: 0.5,
//   info: {
//     reason: "スコアが0.5なのは、カバレッジは良好(0.75)で設立年、最初の車種、発売日に言及していますが、
//           会社の設立をMartin EberhardとMarc TarpenningではなくElon Muskに誤って帰属させているため、
//           アライメントスコアが低く(0.5)なっています。
//           最終スコアは、優れた要約には事実の正確性とカバレッジの両方が必要であることを保証するため、
//           これら2つのスコアの最小値を取ります。"
//     alignmentScore: 0.5,
//     coverageScore: 0.75,
//   }
// }
```

## 関連項目 \{#related\}

* [Faithfulness 指標](./faithfulness)
* [Completeness 指標](./completeness)
* [Contextual Recall 指標](./contextual-recall)
* [Hallucination 指標](./hallucination)