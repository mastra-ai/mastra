---
title: "リファレンス: コンテキスト位置"
description: Mastra における Context Position メトリクスのドキュメント。クエリおよび出力との関連性に基づき、コンテキストノードの並び順を評価します。
---

# ContextPositionMetric \{#contextpositionmetric\}

:::info 新しい Scorers API

扱いやすいAPI、エラー分析のためのより豊富なメタデータ、データ構造を柔軟に評価できる新しい評価用API「Scorers」を公開しました。移行は比較的容易ですが、既存のEvals APIのサポートも引き続き行います。

:::

`ContextPositionMetric` クラスは、クエリおよび出力との関連性に基づいて、コンテキストノードの並び順の適切さを評価します。位置に重みづけしたスコアリングにより、最も関連性の高いコンテキストがシーケンスの早い段階に現れることの重要性を強調します。

## 基本的な使用方法 \{#basic-usage\}

```typescript
import { openai } from '@ai-sdk/openai';
import { ContextPositionMetric } from '@mastra/evals/llm';

// 評価用のモデルを設定
const model = openai('gpt-4o-mini');

const metric = new ContextPositionMetric(model, {
  context: [
    '光合成は、植物が太陽光からエネルギーを生成するために使用する生物学的プロセスです。',
    '光合成のプロセスは副産物として酸素を生成します。',
    '植物は成長するために土壌から水分と栄養素を必要とします。',
  ],
});

const result = await metric.measure(
  '光合成とは何ですか?',
  '光合成は、植物が太陽光をエネルギーに変換するプロセスです。',
);

console.log(result.score); // 0から1までの位置スコア
console.log(result.info.reason); // スコアの説明
```

## コンストラクターのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "ModelConfig",
description:
"コンテキストの位置を評価するために使用するモデルの構成",
isOptional: false,
},
{
name: "options",
type: "ContextPositionMetricOptions",
description: "この指標の構成オプション",
isOptional: false,
},
]}
/>

### ContextPositionMetricOptions \{#contextpositionmetricoptions\}

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
description: "取得順で並んだコンテキストの配列",
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

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "score",
type: "number",
description: "位置スコア（0 からスケールの上限まで。既定は 0～1）",
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
description: "スコアに関する詳細な説明",
},
],
},
],
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

この指標は、関連性の二値評価と位置に基づく重み付けを用いて、コンテキストの位置づけを評価します。

### スコアリングプロセス \{#scoring-process\}

1. コンテキスト適合性の評価:
   * 各要素に二値判定（yes/no）を付与
   * シーケンス内の位置を記録
   * 関連性の根拠を記録

2. 位置に基づく重み付け:
   * 先頭に近いほど重みが大きい（weight = 1/(position + 1)）
   * 関連する要素の重みを合計
   * 取り得る最大スコアで正規化

最終スコア: `(weighted_sum / max_possible_sum) * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から、デフォルトは0～1）

* 1.0: 最適 - 最も関連性の高い文脈が先頭
* 0.7～0.9: 良好 - 関連性の高い文脈がおおむね冒頭に位置
* 0.4～0.6: ばらつきあり - 関連性の高い文脈が点在
* 0.1～0.3: やや不十分 - 関連性の高い文脈が主に後半
* 0.0: 並びが不適切 - 関連性の高い文脈が末尾、または欠落

## 解説付きの例 \{#example-with-analysis\}

```typescript
import { openai } from '@ai-sdk/openai';
import { ContextPositionMetric } from '@mastra/evals/llm';

// 評価用のモデルを設定
const model = openai('gpt-4o-mini');

const metric = new ContextPositionMetric(model, {
  context: [
    'バランスの取れた食事は健康にとって重要です。',
    '運動は心臓を強化し、血液循環を改善します。',
    '定期的な運動はストレスや不安を軽減します。',
    '運動器具は高価になる場合があります。',
  ],
});

const result = await metric.measure(
  '運動の効果は何ですか?',
  '定期的な運動は心血管の健康と精神的な健康を改善します。',
);

// 出力例:
// {
//   score: 0.5,
//   info: {
//     reason: "スコアが0.5である理由は、2番目と3番目のコンテキストは運動の効果に
//           非常に関連性が高いものの、シーケンスの先頭に最適に配置されていないためです。
//           最初と最後のコンテキストはクエリに関連性がなく、これが位置による重み付けスコアリングに
//           影響を与えています。"
//   }
// }
```

## 関連項目 \{#related\}

* [コンテキスト精度メトリック](./context-precision)
* [回答関連性メトリック](./answer-relevancy)
* [完全性メトリック](./completeness)

- [コンテキスト関連性メトリック](./context-relevancy)