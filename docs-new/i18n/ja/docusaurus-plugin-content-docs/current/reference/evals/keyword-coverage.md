---
title: "リファレンス：キーワードカバレッジ"
description: Mastra のキーワードカバレッジ指標に関するドキュメント。入力に含まれる重要なキーワードが LLM の出力でどの程度網羅されているかを評価します。
---

# KeywordCoverageMetric \{#keywordcoveragemetric\}

:::info 新しい Scorer API

より扱いやすい API、エラー分析のための豊富なメタデータ、データ構造を評価する柔軟性を備えた新しい評価用 API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`KeywordCoverageMetric` クラスは、LLM の出力が入力の重要なキーワードをどの程度カバーしているかを評価します。一般的な語やストップワードを無視しつつ、キーワードの有無や一致を分析します。

## 基本的な使用方法 \{#basic-usage\}

```typescript
import { KeywordCoverageMetric } from '@mastra/evals/nlp';

const metric = new KeywordCoverageMetric();

const result = await metric.measure(
  'Python プログラミング言語の主な機能は何ですか？',
  'Python は、シンプルな構文と豊富なライブラリで知られる、高水準のプログラミング言語です。',
);

console.log(result.score); // カバレッジスコア（0～1）
console.log(result.info); // キーワードカバレッジに関する詳細なメトリクスを含むオブジェクト
```

## measure() のパラメータ \{#measure-parameters\}

<PropertiesTable
  content={[
{
name: "input",
type: "string",
description: "マッチ対象のキーワードを含む元のテキスト",
isOptional: false,
},
{
name: "output",
type: "string",
description: "キーワードの網羅率を評価するテキスト",
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
description:
"マッチしたキーワードの割合を表すカバレッジスコア（0〜1）",
},
{
name: "info",
type: "object",
description: "キーワードのカバレッジに関する詳細な指標を含むオブジェクト",
properties: [
{
type: "number",
parameters: [
{
name: "matchedKeywords",
type: "number",
description: "出力で検出されたキーワード数",
},
],
},
{
type: "number",
parameters: [
{
name: "totalKeywords",
type: "number",
description: "入力側のキーワード総数",
},
],
},
],
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

このメトリクスは、以下の機能を用いてキーワードを照合し、キーワードの網羅性を評価します:

* 一般語やストップワードのフィルタリング（例: &quot;the&quot;、&quot;a&quot;、&quot;and&quot;）
* 大文字・小文字の区別なしでの照合
* 語形変化への対応
* 技術用語や複合語の特殊な取り扱い

### スコアリング手順 \{#scoring-process\}

1. 入力と出力のキーワードを処理する:
   * 一般的な語やストップワードを除外する
   * 大文字・小文字や語形を正規化する
   * 専門用語や複合語に対応する

2. キーワードのカバレッジを算出する:
   * テキスト間でキーワードをマッチさせる
   * マッチした件数を数える
   * カバレッジ率を計算する

最終スコア: `(matched_keywords / total_keywords) * scale`

### スコアの解釈 \{#score-interpretation\}

（0からの尺度、デフォルトは0～1）

* 1.0: キーワードを完全に網羅
* 0.7～0.9: ほとんどのキーワードを含む良好な網羅性
* 0.4～0.6: いくつかのキーワードが欠ける中程度の網羅性
* 0.1～0.3: 多くのキーワードが欠ける不十分な網羅性
* 0.0: キーワード一致なし

## 分析付きの例 \{#examples-with-analysis\}

```typescript
import { KeywordCoverageMetric } from '@mastra/evals/nlp';

const metric = new KeywordCoverageMetric();

// 完全カバレッジの例
const result1 = await metric.measure(
  'The quick brown fox jumps over the lazy dog',
  'A quick brown fox jumped over a lazy dog',
);
// {
//   score: 1.0,
//   info: {
//     matchedKeywords: 6,
//     totalKeywords: 6
//   }
// }

// 部分カバレッジの例
const result2 = await metric.measure(
  'Python features include easy syntax, dynamic typing, and extensive libraries',
  'Python has simple syntax and many libraries',
);
// {
//   score: 0.67,
//   info: {
//     matchedKeywords: 4,
//     totalKeywords: 6
//   }
// }

// 技術用語の例
const result3 = await metric.measure(
  'Discuss React.js component lifecycle and state management',
  'React components have lifecycle methods and manage state',
);
// {
//   score: 1.0,
//   info: {
//     matchedKeywords: 4,
//     totalKeywords: 4
//   }
// }
```

## 特殊ケース \{#special-cases\}

このメトリックはいくつかの特殊ケースを扱います:

* 入力/出力が空: 両方が空なら 1.0、どちらか一方のみ空なら 0.0 を返す
* 単語が1つ: 1つのキーワードとして扱う
* 技術用語: 複合的な技術用語を保持する（例: &quot;React.js&quot;, &quot;machine learning&quot;）
* 大文字小文字の違い: &quot;JavaScript&quot; は &quot;javascript&quot; と一致する
* 一般的な語: 意味のあるキーワードに焦点を当てるため、スコアリングでは無視する

## 関連 \{#related\}

* [完全性指標](./completeness)
* [コンテンツ類似度指標](./content-similarity)
* [回答の関連性指標](./answer-relevancy)
* [テキスト差分指標](./textual-difference)
* [コンテキストの関連性指標](./context-relevancy)