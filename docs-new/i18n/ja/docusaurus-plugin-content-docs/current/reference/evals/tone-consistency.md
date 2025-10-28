---
title: "リファレンス：トーンの一貫性"
description: Mastra のトーン一貫性メトリクスに関するドキュメント。テキスト内の感情的なトーンと感情極性の一貫性を評価します。
---

# ToneConsistencyMetric \{#toneconsistencymetric\}

:::info 新しい Scorer API

エラー分析のためのメタデータをより多く保存し、データ構造の評価にも柔軟に対応できる、より使いやすい評価用 API「Scorers」をリリースしました。移行は比較的簡単ですが、既存の Evals API も引き続きサポートします。

:::

`ToneConsistencyMetric` クラスは、テキストの感情的なトーンと、その一貫性を評価します。入力と出力のペア間でトーンを比較するモードと、単一のテキスト内でトーンの安定性を分析するモードの2つで動作します。

## 基本的な使い方 \{#basic-usage\}

```typescript
import { ToneConsistencyMetric } from '@mastra/evals/nlp';

const metric = new ToneConsistencyMetric();

// 入出力間のトーンを比較する
const result1 = await metric.measure('この素晴らしい製品が大好き！', 'この製品は本当に素晴らしくて最高！');

// 単一のテキスト内でのトーンの安定性を分析する
const result2 = await metric.measure(
  'サービスは素晴らしい。スタッフは親切。雰囲気は完璧だ。',
  '', // 単一テキスト分析用の空文字列
);

console.log(result1.score); // トーンの一貫性スコア（0〜1）
console.log(result2.score); // トーンの安定性スコア（0〜1）
```

## measure() のパラメータ \{#measure-parameters\}

<PropertiesTable
  content={[
{
name: "input",
type: "string",
description: "トーン分析の対象となるテキスト",
isOptional: false,
},
{
name: "output",
type: "string",
description:
"トーン比較用の参照テキスト（安定性分析の場合は空文字列）",
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
description: "トーンの一貫性／安定性スコア（0～1）",
},
{
name: "info",
type: "object",
description: "トーンに関する詳細情報",
},
]}
/>

### info オブジェクト（トーン比較） \{#info-object-tone-comparison\}

<PropertiesTable
  content={[
{
name: "responseSentiment",
type: "number",
description: "入力テキストの感情スコア",
},
{
name: "referenceSentiment",
type: "number",
description: "出力テキストの感情スコア",
},
{
name: "difference",
type: "number",
description: "感情スコア同士の絶対差",
},
]}
/>

### info オブジェクト（トーンの安定性） \{#info-object-tone-stability\}

<PropertiesTable
  content={[
{
name: "avgSentiment",
type: "number",
description: "文の平均センチメントスコア",
},
{
name: "sentimentVariance",
type: "number",
description: "文間のセンチメントの分散",
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

この指標は、トーンのパターン分析とモード別スコアリングにより、感情の一貫性を評価します。

### スコアリングプロセス \{#scoring-process\}

1. トーンパターンを解析:
   * センチメントの特徴量を抽出
   * センチメントスコアを算出
   * トーンの変動を測定

2. モード別スコアを算出:
   **トーンの一貫性**（入力と出力）:

   * テキスト間のセンチメントを比較
   * センチメント差分を算出
   * スコア = 1 - (sentiment&#95;difference / max&#95;difference)

   **トーンの安定性**（単一入力）:

   * 文間のセンチメントを分析
   * センチメント分散を算出
   * スコア = 1 - (sentiment&#95;variance / max&#95;variance)

最終スコア: `mode_specific_score * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から、デフォルトは0～1）

* 1.0: トーンの一貫性／安定性が完全
* 0.7～0.9: 小さな変動はあるが高い一貫性
* 0.4～0.6: 目立つ変動を伴う中程度の一貫性
* 0.1～0.3: 大きなトーン変化がある低い一貫性
* 0.0: 一貫性なし――まったく異なるトーン

## 両方のモードを併用する例 \{#example-with-both-modes\}

```typescript
import { ToneConsistencyMetric } from '@mastra/evals/nlp';

const metric = new ToneConsistencyMetric();

// トーンの一貫性モード
const consistencyResult = await metric.measure(
  'この製品は本当に素晴らしくて最高です！',
  'この製品は非常に優れていて素晴らしい！',
);
// 出力例:
// {
//   score: 0.95,
//   info: {
//     responseSentiment: 0.8,
//     referenceSentiment: 0.75,
//     difference: 0.05
//   }
// }

// トーンの安定性モード
const stabilityResult = await metric.measure('素晴らしいサービス！フレンドリーなスタッフ。完璧な雰囲気。', '');
// 出力例:
// {
//   score: 0.9,
//   info: {
//     avgSentiment: 0.6,
//     sentimentVariance: 0.1
//   }
// }
```

## 関連項目 \{#related\}

* [コンテンツ類似度メトリクス](./content-similarity)
* [有害性メトリクス](./toxicity)