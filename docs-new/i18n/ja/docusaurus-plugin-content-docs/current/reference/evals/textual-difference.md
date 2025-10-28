---
title: "リファレンス：Textual Difference"
description: Mastra における Textual Difference 指標のドキュメント。シーケンス照合を用いて文字列間の差異を測定します。
---

# TextualDifferenceMetric \{#textualdifferencemetric\}

:::info 新しい Scorer API

新しい評価用 API「Scorers」をリリースしました。より扱いやすい API、エラー分析に役立つより豊富なメタデータの保存、データ構造の評価に対する柔軟性の向上などが特長です。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`TextualDifferenceMetric` クラスは、シーケンスマッチングを用いて2つの文字列間のテキスト上の差異を測定します。あるテキストを別のテキストへ変換するのに必要な操作数など、変更点に関する詳細情報を提供します。

## 基本的な使い方 \{#basic-usage\}

```typescript
import { TextualDifferenceMetric } from '@mastra/evals/nlp';

const metric = new TextualDifferenceMetric();

const result = await metric.measure('The quick brown fox', 'The fast brown fox');

console.log(result.score); // 0から1の類似度
console.log(result.info); // 詳細な変更指標
```

## measure() のパラメーター \{#measure-parameters\}

<PropertiesTable
  content={[
{
name: "input",
type: "string",
description: "比較対象となる元のテキスト",
isOptional: false,
},
{
name: "output",
type: "string",
description: "差分を評価するテキスト",
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
description: "類似度（0〜1）。1 はテキストが同一であることを示す",
},
{
name: "info",
description: "差分に関する詳細なメトリクス",
properties: [
{
type: "number",
parameters: [
{
name: "confidence",
type: "number",
description:
"テキスト間の長さの差に基づく信頼スコア（0〜1）",
},
],
},
{
type: "number",
parameters: [
{
name: "ratio",
type: "number",
description: "テキスト間の未加工の類似度（比率）",
},
],
},
{
type: "number",
parameters: [
{
name: "changes",
type: "number",
description:
"変更操作の回数（挿入・削除・置換）",
},
],
},
{
type: "number",
parameters: [
{
name: "lengthDiff",
type: "number",
description:
"入力と出力の長さの正規化差（0〜1）",
},
],
},
],
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

この指標は以下の項目を算出します:

* **類似度比**: テキスト間のシーケンス照合に基づく値（0〜1）
* **変更数**: 不一致を解消するために必要な操作回数
* **長さの差**: テキスト長の正規化された差分
* **信頼度**: 長さの差に反比例する値

### スコアリングプロセス \{#scoring-process\}

1. テキスト差分の解析:
   * 入力と出力のシーケンスを照合
   * 必要な変更操作の回数をカウント
   * 長さの差分を測定

2. 指標の計算:
   * 類似度率を算出
   * 信頼度スコアを算定
   * 重み付きスコアに統合

最終スコア: `(similarity_ratio * confidence) * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から、デフォルトは0～1）

* 1.0：テキストは同一（差異なし）
* 0.7～0.9：軽微な差異（ごくわずかな修正が必要）
* 0.4～0.6：中程度の差異（大幅な修正が必要）
* 0.1～0.3：大きな差異（大規模な修正が必要）
* 0.0：まったく異なるテキスト

## 解析付きの例 \{#example-with-analysis\}

```typescript
import { TextualDifferenceMetric } from '@mastra/evals/nlp';

const metric = new TextualDifferenceMetric();

const result = await metric.measure('Hello world! How are you?', 'Hello there! How is it going?');

// 出力例:
// {
//   score: 0.65,
//   info: {
//     confidence: 0.95,
//     ratio: 0.65,
//     changes: 2,
//     lengthDiff: 0.05
//   }
// }
```

## 関連 \{#related\}

* [コンテンツ類似度指標](./content-similarity)
* [完全性指標](./completeness)
* [キーワード網羅性指標](./keyword-coverage)