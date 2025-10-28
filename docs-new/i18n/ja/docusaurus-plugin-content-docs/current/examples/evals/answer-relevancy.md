---
title: "回答の妥当性"
description: クエリに対する回答の適合度を評価するために、Answer Relevancy 指標を用いる例。
---

# 回答の関連性評価 \{#answer-relevancy-evaluation\}

:::info 新しい Scorer API

評価用の新しい API「Scorers」をリリースしました。より扱いやすい API、エラー分析のためのより豊富なメタデータ、そしてデータ構造を評価するための柔軟性を備えています。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`AnswerRelevancyMetric` を使用して、応答が元のクエリにどれだけ関連しているかを評価します。このメトリクスは `query` と `response` を受け取り、スコアと、理由を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## 関連性が高い例 \{#high-relevancy-example\}

この例では、回答が具体的で適切な情報を用いて入力クエリに正確に応答しています。

```typescript filename="src/example-high-answer-relevancy.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { AnswerRelevancyMetric } from '@mastra/evals/llm';

const metric = new AnswerRelevancyMetric(openai('gpt-4o-mini'));

const query = '定期的な運動による健康効果は何ですか?';
const response =
  '定期的な運動は心血管系の健康を改善し、筋肉を強化し、代謝を促進し、エンドルフィンの分泌により精神的な健康を向上させます。';

const result = await metric.measure(query, response);

console.log(result);
```

### 関連性が高い出力 \{#high-relevancy-output\}

この出力は、無関係な情報を含めずにクエリに正確に答えているため、高いスコアを獲得します。

```typescript
{
  score: 1,
  info: {
    reason: 'スコアが1である理由は、出力が質問に直接答えており、心血管系の健康、筋力、代謝、メンタルヘルスの改善など、定期的な運動による複数の明確な健康効果を示しているためです。各項目は関連性があり、健康効果の包括的な理解に貢献しています。'
  }
}
```

## 関連性が部分的な例 \{#partial-relevancy-example\}

この例では、回答はクエリの一部には対応しているものの、直接は関係しない追加情報も含まれています。

```typescript filename="src/example-partial-answer-relevancy.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { AnswerRelevancyMetric } from '@mastra/evals/llm';

const metric = new AnswerRelevancyMetric(openai('gpt-4o-mini'));

const query = '健康的な朝食には何を含めるべきですか?';
const response =
  '栄養価の高い朝食には全粒穀物とタンパク質を含めるべきです。しかし、朝食のタイミングも同様に重要です。研究によると、起床後2時間以内に食事をすることで、一日を通じて代謝とエネルギーレベルが最適化されることが示されています。';

const result = await metric.measure(query, response);

console.log(result);
```

### 関連性が一部にとどまる出力 \{#partial-relevancy-output\}

クエリに一部しか回答していないため、スコアは低くなります。関連情報は含まれているものの、無関係な詳細が全体の関連性を損なっています。

```typescript
{
  score: 0.25,
  info: {
    reason: 'スコアが0.25なのは、出力が全粒穀物とタンパク質を健康的な朝食の構成要素として挙げており、質問に対して直接的な回答を提供しているためです。ただし、朝食のタイミングや代謝・エネルギーレベルへの影響といった追加情報は質問と直接関係がないため、全体的な関連性スコアが低くなっています。'
  }
}
```

## 関連性の低い例 \{#low-relevancy-example\}

この例では、回答が問い合わせに応えておらず、内容が完全に無関係な情報で構成されています。

```typescript filename="src/example-low-answer-relevancy.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { AnswerRelevancyMetric } from '@mastra/evals/llm';

const metric = new AnswerRelevancyMetric(openai('gpt-4o-mini'));

const query = '瞑想の効果は何ですか?';
const response =
  '万里の長城は全長13,000マイル以上で、明朝時代に侵略を防ぐために建設されました。';

const result = await metric.measure(query, response);

console.log(result);
```

### 関連性の低い出力 \{#low-relevancy-output\}

この出力は、クエリに答えられておらず、関連する情報も提供していないため、スコアは0となります。

```typescript
{
  score: 0,
  info: {
    reason: 'スコアが0である理由は、万里の長城に関する出力が瞑想の効果とは全く関係がなく、入力された質問に対する関連情報や文脈が一切提供されていないためです。'
  }
}
```

## メトリクスの設定 \{#metric-configuration\}

任意のパラメータを調整することで、`AnswerRelevancyMetric` のスコア算出方法をカスタマイズできます。たとえば、`uncertaintyWeight` は不確かな応答にどの程度の重みを与えるかを制御し、`scale` は取り得る最大スコアを設定します。

```typescript showLineNumbers copy
const metric = new AnswerRelevancyMetric(openai('gpt-4o-mini'), {
  uncertaintyWeight: 0.3,
  scale: 1,
});
```

> 設定オプションの全一覧は [AnswerRelevancyMetric](/docs/reference/evals/answer-relevancy) を参照してください。

## 結果の理解 \{#understanding-the-results\}

`AnswerRelevancyMetric` は次の形式の結果を返します:

```typescript
{
  score: number,
  info: {
    reason: string
  }
}
```

### 関連性スコア \{#relevancy-score\}

0〜1の範囲の関連性スコア:

* **1.0**: 応答は問い合わせに完全に答えており、関連性が高く要点を押さえた情報で構成されている。
* **0.7–0.9**: 応答は概ね問い合わせに答えているが、わずかに無関係な内容を含む場合がある。
* **0.4–0.6**: 応答は部分的に問い合わせに答えているが、関連する情報と無関係な情報が混在している。
* **0.1–0.3**: 応答は関連する内容がごくわずかで、問い合わせの意図を大きく外している。
* **0.0**: 応答はまったく無関係で、問い合わせに答えていない。

### 関連性に関する情報 \{#relevancy-info\}

スコアの説明。詳細は以下を含みます：

* クエリと回答の整合性
* コンテンツの焦点と関連性
* 回答を改善するための提案

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/answer-relevancy" />