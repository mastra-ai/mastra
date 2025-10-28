---
title: "テキスト差分"
description: シーケンスの差分や変化を分析し、テキスト文字列間の類似性を評価するために Textual Difference 指標を用いる例。
---

# テキスト差分評価 \{#textual-difference-evaluation\}

:::info 新しい Scorer API

より扱いやすい API、エラー分析のための豊富なメタデータ、そしてデータ構造を評価するための柔軟性を備えた新しい評価用 API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`TextualDifferenceMetric` を使用すると、シーケンスの差分と編集操作を分析して、2 つのテキスト文字列の類似度を評価できます。このメトリックは `query` と `response` を受け取り、スコアと、confidence・ratio・変更数・長さ差を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## 差異なしの例 \{#no-differences-example\}

この例では、テキストは完全に同一です。指標は満点で完全一致を判定し、変更は検出されません。

```typescript filename="src/example-no-differences.ts" showLineNumbers copy
import { TextualDifferenceMetric } from '@mastra/evals/nlp';

const metric = new TextualDifferenceMetric();

const query = '素早い茶色のキツネが怠惰な犬を飛び越える。';
const response = '素早い茶色のキツネが怠惰な犬を飛び越える。';

const result = await metric.measure(query, response);

console.log(result);
```

### 差分は出力されません \{#no-differences-output\}

このメトリクスは高スコアを返し、テキストが同一であることを示しています。詳細情報でも変更は一切なく、長さの差もないことが確認できます。

```typescript
{
  score: 1,
  info: {
    confidence: 1,
    ratio: 1,
    changes: 0,
    lengthDiff: 0
  }
}
```

## 些細な違いの例 \{#minor-differences-example\}

この例では、テキストにわずかな違いがあります。評価指標はこうした細かな違いを検出し、類似度は中程度と判定されます。

```typescript filename="src/example-minor-differences.ts" showLineNumbers copy
import { TextualDifferenceMetric } from '@mastra/evals/nlp';

const metric = new TextualDifferenceMetric();

const query = 'こんにちは世界!お元気ですか?';
const response = 'やあ!調子はどう?';

const result = await metric.measure(query, response);

console.log(result);
```

### 軽微な差分の出力 \{#minor-differences-output\}

このメトリクスは、テキスト間のわずかな差異を反映して、ほどほどのスコアを返します。詳細情報には、変更数と長さの差分が含まれます。

```typescript
{
  score: 0.5925925925925926,
  info: {
    confidence: 0.8620689655172413,
    ratio: 0.5925925925925926,
    changes: 5,
    lengthDiff: 0.13793103448275862
  }
}
```

## 大きな差異の例 \{#major-differences-example\}

この例では、テキストに大きな違いがあります。指標は広範な変更を検出し、低い類似度スコアを返します。

```typescript filename="src/example-major-differences.ts" showLineNumbers copy
import { TextualDifferenceMetric } from '@mastra/evals/nlp';

const metric = new TextualDifferenceMetric();

const query = 'Python は高水準のプログラミング言語です。';
const response = 'JavaScript はウェブ開発に使われます';

const result = await metric.measure(query, response);

console.log(result);
```

### 主要な差分の出力 \{#major-differences-output\}

テキスト間に大きな差異があるため、メトリクスのスコアは低くなります。詳細情報には多数の変更点と、長さの大きな違いが示されています。

```typescript
{
  score: 0.3170731707317073,
  info: {
    confidence: 0.8636363636363636,
    ratio: 0.3170731707317073,
    changes: 8,
    lengthDiff: 0.13636363636363635
  }
}
```

## メトリクスの構成 \{#metric-configuration\}

`TextualDifferenceMetric` インスタンスはデフォルトの設定で作成できます。追加の設定は不要です。

```typescript
const metric = new TextualDifferenceMetric();
```

> すべての設定オプションの一覧は、[TextualDifferenceMetric](/docs/reference/evals/textual-difference)を参照してください。

## 結果の理解 \{#understanding-the-results\}

`TextualDifferenceMetric` は次の形の結果を返します:

```typescript
{
  score: 数値,
  info: {
    confidence: 数値,
    ratio: 数値,
    changes: 数値,
    lengthDiff: 数値
  }
}
```

### テキスト差異スコア \{#textual-difference-score\}

0〜1の範囲のテキスト差異スコア:

* **1.0**: テキストは同一 — 差異なし。
* **0.7–0.9**: 軽微な差異 — わずかな修正が必要。
* **0.4–0.6**: 中程度の差異 — 目に見える修正が必要。
* **0.1–0.3**: 大きな差異 — 大幅な修正が必要。
* **0.0**: 完全に異なるテキスト。

### 文字列の差分情報 \{#textual-difference-info\}

スコアの説明（以下の詳細を含む）:

* テキスト長の比較に基づく信頼度。
* シーケンスマッチングから算出される類似度比。
* テキストを一致させるのに必要な編集操作の数。
* テキスト長の正規化された差。

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/textual-difference" />