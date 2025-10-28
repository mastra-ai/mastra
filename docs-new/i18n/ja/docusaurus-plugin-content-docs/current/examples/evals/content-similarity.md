---
title: "コンテンツの類似度"
description: コンテンツ間のテキストの類似性を、Content Similarity 指標で評価する例。
---

# コンテンツ類似度評価 \{#content-similarity-evaluation\}

:::info 新しい Scorers API

私たちは、より使いやすいAPI、エラー分析のためのより豊富なメタデータ、そしてデータ構造を柔軟に評価できる新しい評価API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`ContentSimilarityMetric` を使用すると、コンテンツの重なりに基づいて、レスポンスが参照とどの程度類似しているかを評価できます。このメトリックは `query` と `response` を受け取り、スコアと、類似度の値を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## 高い類似度の例 \{#high-similarity-example\}

この例では、応答は構造と意味の両面でクエリに非常によく似ています。時制や言い回しの細かな違いは、全体的な類似度に大きく影響しません。

```typescript filename="src/example-high-similarity.ts" showLineNumbers copy
import { ContentSimilarityMetric } from '@mastra/evals/nlp';

const metric = new ContentSimilarityMetric();

const query = '素早い茶色のキツネが怠惰な犬を飛び越える。';
const response = '素早い茶色のキツネが怠惰な犬を飛び越えた。';

const result = await metric.measure(query, response);

console.log(result);
```

### 類似度の高い出力 \{#high-similarity-output\}

この出力は、表現をわずかに言い換えるだけでクエリの意図と内容を保持しているため、高いスコアを獲得します。

```typescript
{
  score: 0.7761194029850746,
  info: {
    similarity: 0.7761194029850746
  }
}
```

## 中程度の類似性の例 \{#moderate-similarity-example\}

この例では、応答はクエリと概念的にいくらか重なっていますが、構成や表現は異なります。主要な要素は保たれているものの、言い回しには中程度の変化があります。

```typescript filename="src/example-moderate-similarity.ts" showLineNumbers copy
import { ContentSimilarityMetric } from '@mastra/evals/nlp';

const metric = new ContentSimilarityMetric();

const query = '茶色のキツネが素早く眠っている犬を飛び越える。';
const response = '素早い茶色のキツネが怠惰な犬を飛び越える。';

const result = await metric.measure(query, response);

console.log(result);
```

### 中程度の類似度の出力 \{#moderate-similarity-output\}

応答はクエリの要旨を捉えているものの、表現の違いが比較的大きく、全体の類似度が下がっているため、スコアは中程度となります。

```typescript
{
  score: 0.40540540540540543,
  info: {
    similarity: 0.40540540540540543
  }
}
```

## 類似度が低い例 \{#low-similarity-example\}

この例では、応答とクエリは文法構造こそ似ているものの、意味的には無関係です。共有される内容の重なりはほとんど、あるいはまったくありません。

```typescript filename="src/example-low-similarity.ts" showLineNumbers copy
import { ContentSimilarityMetric } from '@mastra/evals/nlp';

const metric = new ContentSimilarityMetric();

const query = '猫が窓辺で眠っている。';
const response = '素早い茶色のキツネが怠惰な犬を飛び越える。';

const result = await metric.measure(query, response);

console.log(result);
```

### 類似度の低い出力 \{#low-similarity-output\}

応答がクエリの内容や意図に合致していないため、低いスコアとなります。

```typescript
{
  score: 0.25806451612903225,
  info: {
    similarity: 0.25806451612903225
  }
}
```

## メトリクスの設定 \{#metric-configuration\}

`ContentSimilarityMetric` のインスタンスはデフォルト設定で作成できます。追加の設定は不要です。

```typescript showLineNumbers copy
const metric = new ContentSimilarityMetric();
```

> 設定オプションの一覧については、[ContentSimilarityMetric](/docs/reference/evals/content-similarity) を参照してください。

## 結果の理解 \{#understanding-the-results\}

`ContentSimilarityMetric` は次の形の結果を返します：

```typescript
{
  score: number,
  info: {
    similarity: number
  }
}
```

### 類似度スコア \{#similarity-score\}

0から1の間の類似度スコア:

* **1.0**: 完全一致 – コンテンツはほぼ同一。
* **0.7–0.9**: 高い類似度 – 語彙や構成にわずかな違い。
* **0.4–0.6**: 中程度の類似度 – おおむね重なるが、目立つ差異がある。
* **0.1–0.3**: 低い類似度 – 共通要素や意味の重なりが少ない。
* **0.0**: 類似なし – まったく異なるコンテンツ。

### 類似度情報 \{#similarity-info\}

スコアの説明。詳細は以下のとおりです：

* クエリと応答の重なりの度合い
* 一致するフレーズやキーワード
* テキスト類似度に基づく意味的な近さ

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/content-similarity" />