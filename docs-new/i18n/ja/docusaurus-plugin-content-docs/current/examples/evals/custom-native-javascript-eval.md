---
title: "単語の包含"
description: 独自のネイティブJavaScript評価指標を作成する例。
---

# カスタムネイティブ JavaScript 評価 \{#custom-native-javascript-evaluation\}

:::info 新しい Scorers API

使いやすい API、エラー分析のためのより豊富なメタデータ、データ構造を柔軟に評価できる機能を備えた、新しい評価用 API「Scorers」をリリースしました。移行は比較的簡単ですが、既存の Evals API も引き続きサポートします。

:::

この例では、JavaScript のロジックを使ってカスタム評価指標を作成する方法を示します。指標は `query` と `response` を受け取り、スコアと、総語数および一致語数を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash
npm install @mastra/evals
```

## カスタム Eval を作成する \{#create-a-custom-eval\}

Mastra のカスタム Eval では、条件を判定するためにネイティブの JavaScript メソッドを使用できます。

```typescript filename="src/mastra/evals/example-word-inclusion.ts" showLineNumbers copy
import { Metric, type MetricResult } from '@mastra/core';

export class WordInclusionMetric extends Metric {
  constructor() {
    super();
  }

  async measure(input: string, output: string): Promise<MetricResult> {
    const tokenize = (text: string) => text.toLowerCase().match(/\b\w+\b/g) || [];

    const referenceWords = [...new Set(tokenize(input))];
    const outputText = output.toLowerCase();

    const matchedWords = referenceWords.filter(word => outputText.includes(word));

    const totalWords = referenceWords.length;
    const score = totalWords > 0 ? matchedWords.length / totalWords : 0;

    return {
      score,
      info: {
        totalWords,
        matchedWords: matchedWords.length,
      },
    };
  }
}
```

## 高カスタムの例 \{#high-custom-example\}

この例では、レスポンスに入力クエリで列挙されたすべての単語が含まれています。メトリックは、単語が完全に含まれていることを示す高いスコアを返します。

```typescript filename="src/example-high-word-inclusion.ts" showLineNumbers copy
import { WordInclusionMetric } from './mastra/evals/example-word-inclusion';

const metric = new WordInclusionMetric();

const query = 'りんご、バナナ、オレンジ';
const response = '私の好きな果物は:りんご、バナナ、オレンジです。';

const result = await metric.measure(query, response);

console.log(result);
```

### 高いカスタム出力 \{#high-custom-output\}

この出力は高得点です。入力に含まれる一意の語がすべて応答に含まれており、完全に網羅していることが示されているためです。

```typescript
{
  score: 1,
  info: {
    totalWords: 3,
    matchedWords: 3
  }
}
```

## 部分的なカスタム例 \{#partial-custom-example\}

この例では、応答に入力クエリの単語の一部は含まれますが、すべては含まれません。評価指標は、この不完全な単語の網羅性を反映した部分スコアを返します。

```typescript filename="src/example-partial-word-inclusion.ts" showLineNumbers copy
import { WordInclusionMetric } from './mastra/evals/example-word-inclusion';

const metric = new WordInclusionMetric();

const query = '猫、犬、ウサギ';
const response = '私は犬とウサギが好きです';

const result = await metric.measure(query, response);

console.log(result);
```

### 部分的なカスタム出力 \{#partial-custom-output\}

このスコアは、応答が入力に含まれる固有語の一部しか含んでおらず、語の包含が不完全であることを示しているため、部分的な成功を示しています。

```typescript
{
  score: 0.6666666666666666,
  info: {
    totalWords: 3,
    matchedWords: 2
  }
}
```

## 低スコアの例 \{#low-custom-example\}

この例では、応答には入力クエリの語が一切含まれていません。指標は語の包含がないことを示す低スコアを返します。

```typescript filename="src/example-low-word-inclusion.ts" showLineNumbers copy
import { WordInclusionMetric } from './mastra/evals/example-word-inclusion';

const metric = new WordInclusionMetric();

const query = 'Colombia, Brazil, Panama';
const response = "Let's go to Mexico";

const result = await metric.measure(query, response);

console.log(result);
```

### カスタム出力が低い \{#low-custom-output\}

入力に含まれる固有の語が応答内に一切現れず、両テキスト間に重なりがないことを示しているため、スコアは0となります。

```typescript
{
  score: 0,
  info: {
    totalWords: 3,
    matchedWords: 0
  }
}
```

## 結果の見方 \{#understanding-the-results\}

`WordInclusionMetric` は次の形式の結果を返します:

```typescript
{
  score: number,
  info: {
    totalWords: number,
    matchedWords: number
  }
}
```

### カスタムスコア \{#custom-score\}

0〜1のスコア:

* **1.0**: 応答に入力のすべての単語が含まれている。
* **0.5–0.9**: 応答に一部の単語は含まれるが、すべてではない。
* **0.0**: 入力の単語は応答にまったく含まれない。

### カスタム情報 \{#custom-info\}

スコアの説明（詳細）:

* `totalWords` は、入力内で見つかったユニークな単語の数です。
* `matchedWords` は、応答内にも出現したそれらの単語の数です。
* スコアは `matchedWords / totalWords` で算出します。
* 入力内に有効な単語が見つからない場合、スコアは既定で `0` になります。

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/word-inclusion" />