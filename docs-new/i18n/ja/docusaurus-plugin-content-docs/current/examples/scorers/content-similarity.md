---
title: "コンテンツの類似度"
description: コンテンツ間のテキストの類似性を評価するために Content Similarity スコアラーを使用する例。
---

# コンテンツ類似度スコアラー \{#content-similarity-scorer\}

`createContentSimilarityScorer` を使って、内容の重なりに基づき、応答が参照とどの程度似ているかを評価します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

> API の詳細なドキュメントと設定オプションについては、[`createContentSimilarityScorer`](/docs/reference/scorers/content-similarity) を参照してください。

## 類似度が高い例 \{#high-similarity-example\}

この例では、応答は構造と意味の両面でクエリと非常に近い内容になっています。時制や表現のわずかな違いは、全体の類似度にほとんど影響しません。

```typescript filename="src/example-high-similarity.ts" showLineNumbers copy
import { createContentSimilarityScorer } from '@mastra/evals/scorers/llm';

const scorer = createContentSimilarityScorer();

const query = '素早い茶色のキツネが怠け者の犬を飛び越える。';
const response = '素早い茶色のキツネが怠け者の犬を飛び越えた。';

const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});

console.log(result);
```

### 類似度が高い出力 \{#high-similarity-output\}

この出力は、問い合わせの意図と内容を維持しつつ、表現の変更がごくわずかであるため、高いスコアを獲得します。

```typescript
{
  score: 0.7761194029850746,
  analyzeStepResult: {
    similarity: 0.7761194029850746
  },
}
```

## 中程度の類似度の例 \{#moderate-similarity-example\}

この例では、応答はクエリと概念的にはいくらか重なりますが、構成や表現は異なります。主要な要素は維持されているものの、言い回しには中程度の変化が加えられています。

```typescript filename="src/example-moderate-similarity.ts" showLineNumbers copy
import { createContentSimilarityScorer } from '@mastra/evals/scorers/llm';

const scorer = createContentSimilarityScorer();

const query = '茶色いキツネが眠っている犬の上を素早く飛び越える。';
const response = '素早い茶色いキツネが怠け者の犬を飛び越える。';

const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});

console.log(result);
```

### 中程度の類似度の出力 \{#moderate-similarity-output\}

この出力は、クエリの大意は捉えているものの、表現の違いが全体の類似度を下げているため、スコアは中程度となります。

```typescript
{
  score: 0.40540540540540543,
  analyzeStepResult: {
    similarity: 0.40540540540540543
  }
}
```

## 類似度が低い例 \{#low-similarity-example\}

この例では、応答とクエリは文法構造は似ているものの、意味的には無関係です。共有される内容の重なりはほとんど、あるいはまったくありません。

```typescript filename="src/example-low-similarity.ts" showLineNumbers copy
import { createContentSimilarityScorer } from '@mastra/evals/scorers/llm';

const scorer = createContentSimilarityScorer();

const query = '猫が窓辺で眠っている。';
const response = '素早い茶色のキツネが怠惰な犬を飛び越える。';

const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});

console.log(result);
```

### 類似度の低い出力 \{#low-similarity-output\}

この出力は、応答がクエリの内容や意図と一致していないため、低いスコアとなります。

```typescript
{
  score: 0.25806451612903225,
  analyzeStepResult: {
    similarity: 0.25806451612903225
  },
}
```

## スコアラーの設定 \{#scorer-configuration\}

`ContentSimilarityScorer` はオプションを受け付けません。常にデフォルト設定で作成されます。

```typescript showLineNumbers copy
const scorer = createContentSimilarityScorer();
```

## 結果の理解 \{#understanding-the-results\}

`.run()` は次の形の結果を返します:

```typescript
{
  runId: 文字列,
  extractStepResult: {
    processedInput: 文字列,
    processedOutput: 文字列
  },
  analyzeStepResult: {
    similarity: 数値
  },
  score: 数値
}
```

### score \{#score\}

0 から 1 の類似度スコア:

* **1.0**: 完全一致 – 内容はほぼ同一。
* **0.7–0.9**: 高い類似度 – 語句や構成にわずかな違い。
* **0.4–0.6**: 中程度の類似度 – 大枠は重なるが、目立つ差異がある。
* **0.1–0.3**: 低い類似度 – 共通する要素や意味が少ない。
* **0.0**: 類似なし – 内容がまったく異なる。

### runId \{#runid\}

このスコアラー実行のための一意の識別子です。

### extractStepResult \{#extractstepresult\}

正規化後の入力文字列と出力文字列を含むオブジェクト:

* **processedInput**: 正規化された入力文字列。
* **processedOutput**: 正規化された出力文字列。

### analyzeStepResult \{#analyzestepresult\}

類似度スコアを含むオブジェクト:

* **similarity**: 0 から 1 の範囲で計算された類似度の値。

<GithubLink marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/scorers/content-similarity" />