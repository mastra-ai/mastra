---
title: "リファレンス: コンテンツ類似度"
description: Mastra におけるコンテンツ類似度メトリクスのドキュメント。文字列間のテキストの類似度を測定し、一致度スコアを提供します。
---

# ContentSimilarityMetric \{#contentsimilaritymetric\}

:::info 新しい Scorer API

新しい評価用 API「Scorers」をリリースしました。より扱いやすい API、エラー分析のための豊富なメタデータの保存、そしてデータ構造を評価する柔軟性を備えています。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`ContentSimilarityMetric` クラスは、2 つの文字列間のテキスト類似度を測定し、それらの一致度を示すスコアを提供します。大文字・小文字の区別や空白の扱いを設定可能なオプションとしてサポートします。

## 基本的な使い方 \{#basic-usage\}

```typescript
import { ContentSimilarityMetric } from '@mastra/evals/nlp';

const metric = new ContentSimilarityMetric({
  ignoreCase: true,
  ignoreWhitespace: true,
});

const result = await metric.measure('Hello, world!', 'hello world');

console.log(result.score); // 0から1の類似度スコア
console.log(result.info); // 詳細な類似度指標
```

## コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "ContentSimilarityOptions",
description: "類似度比較の設定オプション",
isOptional: true,
defaultValue: "{ ignoreCase: true, ignoreWhitespace: true }",
},
]}
/>

### ContentSimilarityOptions \{#contentsimilarityoptions\}

<PropertiesTable
  content={[
{
name: "ignoreCase",
type: "boolean",
description: "文字列比較の際に大文字・小文字の違いを無視するかどうか",
isOptional: true,
defaultValue: "true",
},
{
name: "ignoreWhitespace",
type: "boolean",
description: "文字列比較の際に空白を正規化するかどうか",
isOptional: true,
defaultValue: "true",
},
]}
/>

## measure() のパラメータ \{#measure-parameters\}

<PropertiesTable
  content={[
{
name: "input",
type: "string",
description: "比較の基準となる参照テキスト",
isOptional: false,
},
{
name: "output",
type: "string",
description: "類似度を評価するテキスト",
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
description:
"類似度スコア（0〜1）。1 は完全な類似性を示します",
},
{
name: "info",
type: "object",
description: "類似度に関する詳細な指標",
properties: [
{
type: "number",
parameters: [
{
name: "similarity",
type: "number",
description: "2 つのテキスト間の生の類似度スコア",
},
],
},
],
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

この指標は、文字単位の照合と設定可能なテキスト正規化を用いて、テキストの類似度を評価します。

### スコアリングプロセス \{#scoring-process\}

1. テキストを正規化:
   * 大文字・小文字の正規化（ignoreCase: true の場合）
   * 空白の正規化（ignoreWhitespace: true の場合）

2. 正規化後の文字列を文字列類似度アルゴリズムで比較:
   * 文字列の並びを解析
   * 単語境界を整合
   * 相対的な位置を考慮
   * 長さの差を補正

最終スコア: `similarity_value * scale`

### スコアの解釈 \{#score-interpretation\}

（スケール範囲：0、既定値は0〜1）

* 1.0: 完全一致 - テキストが同一
* 0.7〜0.9: 高い類似度 - 内容の大部分が一致
* 0.4〜0.6: 中程度の類似度 - 部分的に一致
* 0.1〜0.3: 低い類似度 - 一致パターンが少ない
* 0.0: 類似なし - テキストが完全に異なる

## さまざまなオプションの例 \{#example-with-different-options\}

```typescript
import { ContentSimilarityMetric } from '@mastra/evals/nlp';

// 大文字と小文字を区別する比較
const caseSensitiveMetric = new ContentSimilarityMetric({
  ignoreCase: false,
  ignoreWhitespace: true,
});

const result1 = await caseSensitiveMetric.measure('Hello World', 'hello world'); // 大文字と小文字の違いによりスコアが低くなる

// 出力例:
// {
//   score: 0.75,
//   info: { similarity: 0.75 }
// }

// 空白文字を厳密に比較
const strictWhitespaceMetric = new ContentSimilarityMetric({
  ignoreCase: true,
  ignoreWhitespace: false,
});

const result2 = await strictWhitespaceMetric.measure('Hello   World', 'Hello World'); // 空白文字の違いによりスコアが低くなる

// 出力例:
// {
//   score: 0.85,
//   info: { similarity: 0.85 }
// }
```

## 関連 \{#related\}

* [完全性メトリクス](./completeness)
* [テキスト差分メトリクス](./textual-difference)
* [回答関連性メトリクス](./answer-relevancy)
* [キーワード網羅性メトリクス](./keyword-coverage)