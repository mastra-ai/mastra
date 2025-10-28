---
title: "網羅性"
description: 入力要素を応答がどの程度網羅しているかを評価するために、網羅性メトリクスを用いる例。
---

# 完全性の評価 \{#completeness-evaluation\}

:::info 新しい Scorers API

より扱いやすい API、エラー分析のための豊富なメタデータ、データ構造を柔軟に評価できる新しい評価用 API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`CompletenessMetric` を使用して、応答に入力の重要な要素がすべて含まれているかを評価します。このメトリックは `query` と `response` を受け取り、スコアと、要素ごとの詳細な比較を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## 完全カバレッジの例 \{#complete-coverage-example\}

この例では、レスポンスに入力のあらゆる要素が含まれています。内容は完全に一致しており、結果としてカバレッジは完全です。

```typescript filename="src/example-complete-coverage.ts" showLineNumbers copy
import { CompletenessMetric } from '@mastra/evals/nlp';

const metric = new CompletenessMetric();

const query = '三原色は赤、青、黄です。';
const response = '三原色は赤、青、黄です。';

const result = await metric.measure(query, response);

console.log(result);
```

### カバレッジが完全な出力 \{#complete-coverage-output\}

すべての入力要素が欠けることなく応答に含まれているため、出力のスコアは1となります。

```typescript
{
  score: 1,
  info: {
    inputElements: [
      '基本',    '色',
      'は', '赤',
      '青',    'と',
      '黄色'
    ],
    outputElements: [
      '基本',    '色',
      'は', '赤',
      '青',    'と',
      '黄色'
    ],
    missingElements: [],
    elementCounts: { input: 8, output: 8 }
  }
}
```

## 部分的なカバレッジの例 \{#partial-coverage-example\}

この例では、応答にすべての入力要素が含まれている一方で、元のクエリにはなかった追加の内容も含まれています。

```typescript filename="src/example-partial-coverage.ts" showLineNumbers copy
import { CompletenessMetric } from '@mastra/evals/nlp';

const metric = new CompletenessMetric();

const query = '三原色は赤と青です。';
const response = '三原色は赤、青、黄色です。';

const result = await metric.measure(query, response);

console.log(result);
```

### 部分的網羅の出力 \{#partial-coverage-output\}

入力要素が欠けていないため、出力は高評価となります。ただし、応答には入力範囲を超えた余分な内容が含まれています。

```typescript
{
  score: 1,
  info: {
    inputElements: [
      'the',    'primary',
      'colors', 'be',
      'red',    'and',
      'blue'
    ],
    outputElements: [
      'the',    'primary',
      'colors', 'be',
      'red',    'blue',
      'and',    'yellow'
    ],
    missingElements: [],
    elementCounts: { input: 7, output: 8 }
  }
}
```

## 最小限のカバレッジの例 \{#minimal-coverage-example\}

この例では、応答には入力の要素の一部しか含まれていません。重要な用語が欠落している、または変更されているため、カバレッジが低下しています。

```typescript filename="src/example-minimal-coverage.ts" showLineNumbers copy
import { CompletenessMetric } from '@mastra/evals/nlp';

const metric = new CompletenessMetric();

const query = '季節には夏が含まれます。';
const response = '四季は春、夏、秋、冬です。';

const result = await metric.measure(query, response);

console.log(result);
```

### 最小限の網羅性の出力 \{#minimal-coverage-output\}

入力の要素のうち一つ以上が欠けているため、出力のスコアは低くなります。応答は一部は一致していますが、元の内容を完全には反映していません。

```typescript
{
  score: 0.75,
  info: {
    inputElements: [ 'the', 'seasons', 'summer', 'include' ],
    outputElements: [
      'the',     'four',
      'seasons', 'spring',
      'summer',  'winter',
      'be',      'fall',
      'and'
    ],
    missingElements: [ 'include' ],
    elementCounts: { input: 4, output: 9 }
  }
}
```

## メトリクスの設定 \{#metric-configuration\}

`CompletenessMetric` インスタンスはデフォルト設定のまま作成できます。追加の設定は不要です。

```typescript showLineNumbers copy
const metric = new CompletenessMetric();
```

> 設定オプションの全一覧は、[CompletenessMetric](/docs/reference/evals/completeness) を参照してください。

## 結果の理解 \{#understanding-the-results\}

`CompletenessMetric` は、次の形の結果を返します:

```typescript
{
  score: number,
  info: {
    inputElements: string[],
    outputElements: string[],
    missingElements: string[],
    elementCounts: {
      input: number,
      output: number
    }
  }
}

```

### 完全性スコア \{#completeness-score\}

0 から 1 の間の完全性スコア:

* **1.0**: すべての入力要素が応答に含まれている。
* **0.7–0.9**: 主要な要素の大半が含まれており、欠落は最小限。
* **0.4–0.6**: 一部の入力要素は網羅されているが、重要な要素が欠けている。
* **0.1–0.3**: ごく一部の入力要素しか一致せず、ほとんどが欠落している。
* **0.0**: 応答に入力要素がまったく含まれていない。

### 完全性に関する情報 \{#completeness-info\}

スコアの説明。詳細は次を含みます:

* クエリから抽出された入力要素
* レスポンスで一致した出力要素
* レスポンスで欠落している入力要素
* 入力と出力の要素数の比較

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/completeness" />