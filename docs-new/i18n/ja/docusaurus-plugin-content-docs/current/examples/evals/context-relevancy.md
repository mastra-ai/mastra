---
title: "コンテキスト適合度"
description: クエリに対するコンテキスト情報の適合度を評価するために、Context Relevancy メトリクスを使用する例。
---

# コンテキスト関連性評価 \{#context-relevancy-evaluation\}

:::info 新しい Scorer API

より扱いやすい API、エラー分析のためのより豊富なメタデータ、データ構造の評価における柔軟性を備えた新しい評価用 API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API のサポートも継続します。

:::

`ContextRelevancyMetric` を使用して、取得されたコンテキストが元のクエリにどの程度適合しているかを評価します。このメトリクスは `query` と `response` を受け取り、スコアと理由を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## 高い関連性の例 \{#high-relevancy-example\}

この例では、回答はクエリに直接関係するコンテキストのみを使用します。すべてのコンテキスト項目が回答を支えており、その結果、関連性スコアは満点となります。

```typescript filename="src/example-high-context-relevancy.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { ContextRelevancyMetric } from '@mastra/evals/llm';

const metric = new ContextRelevancyMetric(openai('gpt-4o-mini'), {
  context: [
    'アインシュタインは光電効果の発見でノーベル賞を受賞した。',
    '彼は1905年に相対性理論を発表した。',
    '彼の業績は現代物理学に革命をもたらした。',
  ],
});

const query = "アインシュタインの業績には何がありますか?";
const response =
  'アインシュタインは光電効果の発見でノーベル賞を受賞し、画期的な相対性理論を発表した。';

const result = await metric.measure(query, response);

console.log(result);
```

### 関連性が高い出力 \{#high-relevancy-output\}

すべてのコンテキスト文が無関係な情報を含むことなくクエリへの回答に直接貢献しているため、この出力は満点となります。

```typescript
{
  score: 1,
  info: {
    reason: "検索コンテキストがアインシュタインの重要な業績を強調することで入力に直接対応しており、完全に関連性があるため、スコアは1です。"
  }
}
```

## 関連性が混在する例 \{#mixed-relevancy-example\}

この例では、応答が1つ以上の関連するコンテキスト項目を用いつつ、無関係または有用性の低い情報も含んでいます。これにより、全体的な関連性スコアが低下します。

```typescript filename="src/example-mixed-context-relevancy.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { ContextRelevancyMetric } from '@mastra/evals/llm';

const metric = new ContextRelevancyMetric(openai('gpt-4o-mini'), {
  context: [
    '日食は月が太陽を遮ることで発生します。',
    '日食の際、月は地球と太陽の間を移動します。',
    '月は夜に見えます。',
    '月には大気がありません。',
  ],
});

const query = '日食の原因は何ですか?';
const response = '日食は月が地球と太陽の間を移動し、太陽光を遮ることで起こります。';

const result = await metric.measure(query, response);

console.log(result);
```

### 関連性が混在した出力 \{#mixed-relevancy-output\}

この出力は、日食の仕組みに関する有用な文脈を含む一方で、全体的な関連性を損なう無関係な事実も含まれているため、評価は中程度にとどまります。

```typescript
{
  score: 0.5,
  info: {
    reason: "スコアが0.5である理由は、取得コンテキストに入力と無関係な記述が含まれているためです。例えば、「月は夜に見える」や「月には大気がない」といった記述は、日食の原因を説明していません。関連情報の欠如により、コンテキスト関連性スコアが大幅に低下しています。"
  }
}
```

## 関連性が低い例 \{#low-relevancy-example\}

この例では、文脈の大半がクエリと無関係です。該当する項目は1つだけのため、関連性スコアは低くなります。

```typescript filename="src/example-low-context-relevancy.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { ContextRelevancyMetric } from '@mastra/evals/llm';

const metric = new ContextRelevancyMetric(openai('gpt-4o-mini'), {
  context: [
    'グレートバリアリーフはオーストラリアにあります。',
    'サンゴ礁は生存するために暖かい水を必要とします。',
    '海洋生物はサンゴ礁に依存しています。',
    'オーストラリアの首都はキャンベラです。',
  ],
});

const query = 'オーストラリアの首都は何ですか?';
const response = 'オーストラリアの首都はキャンベラです。';

const result = await metric.measure(query, response);

console.log(result);
```

### 関連性の低い出力 \{#low-relevancy-output\}

この出力は、クエリに関連するコンテキスト項目が1つしかないため、低いスコアになります。残りの項目は、応答の根拠とならない無関係な情報を含んでいます。

```typescript
{
  score: 0.25,
  info: {
    reason: "スコアが0.25である理由は、取得されたコンテキストに、オーストラリアの首都に関する入力質問とは全く無関係な記述が含まれているためです。例えば、「グレートバリアリーフはオーストラリアにある」や「サンゴ礁は生存するために温かい水を必要とする」といった記述は、首都に関する地理的または政治的情報を全く提供しておらず、質問に答えられていません。"
  }
}
```

## メトリックの設定 \{#metric-configuration\}

クエリに関連する背景情報を表す `context` 配列を指定して、`ContextRelevancyMetric` のインスタンスを作成できます。スコアの範囲を定義する `scale` などのオプションパラメータも設定できます。

```typescript showLineNumbers copy
const metric = new ContextRelevancyMetric(openai('gpt-4o-mini'), {
  context: [''],
  scale: 1,
});
```

> 設定オプションの一覧については、[ContextRelevancyMetric](/docs/reference/evals/context-relevancy) をご覧ください。

## 結果の理解 \{#understanding-the-results\}

`ContextRelevancyMetric` は次の形の結果を返します。

```typescript
{
  score: number,
  info: {
    reason: string
  }
}
```

### 関連性スコア \{#relevancy-score\}

0〜1 の範囲の関連性スコア:

* **1.0**: 完全に関連 – すべてのコンテキストがクエリに直接関連。
* **0.7–0.9**: 高い関連 – ほとんどのコンテキストがクエリに関連。
* **0.4–0.6**: ばらつきのある関連 – 一部のコンテキストのみがクエリに関連。
* **0.1–0.3**: 低い関連 – クエリに関連するコンテキストがわずか。
* **0.0**: 関連なし – クエリに関連するコンテキストがない。

### 関連性に関する情報 \{#relevancy-info\}

スコアの説明。詳細には次が含まれます：

* 入力クエリとの関連性
* コンテキストからの記述の抽出
* 応答に対する有用性
* コンテキスト全体の品質

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/context-relevancy" />