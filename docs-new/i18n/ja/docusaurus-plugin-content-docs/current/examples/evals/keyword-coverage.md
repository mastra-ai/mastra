---
title: "キーワード網羅率"
description: 入力テキストの重要キーワードが回答でどれだけカバーされているかを評価するために、キーワード網羅率という指標を用いる例。
---

# キーワード網羅性の評価 \{#keyword-coverage-evaluation\}

:::info 新しい Scorer API

より扱いやすい API、エラー分析のためのより豊富なメタデータ、そしてデータ構造を評価する柔軟性を備えた新しい評価用 API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`KeywordCoverageMetric` を使用すると、レスポンスがコンテキスト内の必須キーワードやフレーズをどの程度正確に含んでいるかを評価できます。このメトリックは `query` と `response` を受け取り、スコアと、キーワードの一致状況に関する統計を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## 完全網羅の例 \{#full-coverage-example\}

この例では、応答が入力の重要な用語を余すところなく反映しています。必要なキーワードがすべて含まれており、抜け漏れのない完全な網羅になっています。

```typescript filename="src/example-full-keyword-coverage.ts" showLineNumbers copy
import { KeywordCoverageMetric } from '@mastra/evals/nlp';

const metric = new KeywordCoverageMetric();

const query = 'ReactやVueのようなJavaScriptフレームワーク。';
const response = '人気のJavaScriptフレームワークには、Web開発向けのReactやVueがあります';

const result = await metric.measure(query, response);

console.log(result);
```

### 完全カバレッジの出力 \{#full-coverage-output\}

スコアが 1 の場合、期待されるキーワードがすべて応答内で見つかったことを示します。`info` フィールドでは、一致したキーワード数が入力から抽出された総数と等しいことが確認されます。

```typescript
{
  score: 1,
  info: {
    totalKeywords: 4,
    matchedKeywords: 4
  }
}
```

## 部分的なカバレッジの例 \{#partial-coverage-example\}

この例では、応答は入力の重要なキーワードの一部は含むものの、すべてを網羅しているわけではありません。スコアは部分的なカバレッジを反映しており、主要な用語が欠落している、または完全一致していないことを示します。

```typescript filename="src/example-partial-keyword-coverage.ts" showLineNumbers copy
import { KeywordCoverageMetric } from '@mastra/evals/nlp';

const metric = new KeywordCoverageMetric();

const query = 'TypeScriptはインターフェース、ジェネリクス、型推論を提供します。';
const response = 'TypeScriptは型推論といくつかの高度な機能を提供します';

const result = await metric.measure(query, response);

console.log(result);
```

### 部分的カバレッジの出力 \{#partial-coverage-output\}

スコアが 0.5 の場合、期待されるキーワードのうち半分しか応答内で見つからなかったことを示します。`info` フィールドには、入力で特定された総数に対して、いくつの用語が一致したかが表示されます。

```typescript
{
  score: 0.5,
  info: {
    totalKeywords: 6,
    matchedKeywords: 3
  }
}
```

## カバレッジ最小の例 \{#minimal-coverage-example\}

この例では、応答に入力の重要なキーワードがほとんど含まれていません。スコアはカバレッジが最小であることを反映しており、重要な用語の大半が欠落しているか、拾われていません。

```typescript filename="src/example-minimal-keyword-coverage.ts" showLineNumbers copy
import { KeywordCoverageMetric } from '@mastra/evals/nlp';

const metric = new KeywordCoverageMetric();

const query = '機械学習モデルには、データの前処理、特徴量エンジニアリング、ハイパーパラメータチューニングが必要です';
const response = 'データの準備はモデルにとって重要です';

const result = await metric.measure(query, response);

console.log(result);
```

### カバレッジ最小の出力 \{#minimal-coverage-output\}

低いスコアは、期待されるキーワードのうちごく一部しか応答に含まれていないことを示します。`info` フィールドは、総キーワード数と一致数の差分を示し、カバレッジ不足を示唆します。

```typescript
{
  score: 0.2,
  info: {
    totalKeywords: 10,
    matchedKeywords: 2
  }
}
```

## メトリクスの設定 \{#metric-configuration\}

`KeywordCoverageMetric` インスタンスはデフォルト設定のままで作成できます。追加の設定は必要ありません。

```typescript
const metric = new KeywordCoverageMetric();
```

> 設定オプションの一覧については、[KeywordCoverageMetric](/docs/reference/evals/keyword-coverage) を参照してください。

## 結果の理解 \{#understanding-the-results\}

`KeywordCoverageMetric` は以下の形式の結果を返します:

```typescript
{
  score: number,
  info: {
    totalKeywords: number,
    matchedKeywords: number
  }
}
```

## キーワード網羅スコア \{#keyword-coverage-score\}

網羅スコアは 0 から 1 の範囲です:

* **1.0**: 完全に網羅 – すべてのキーワードを含む。
* **0.7–0.9**: 高い網羅 – ほとんどのキーワードを含む。
* **0.4–0.6**: 部分的な網羅 – 一部のキーワードを含む。
* **0.1–0.3**: 低い網羅 – 一致するキーワードが少ない。
* **0.0**: 非網羅 – キーワードが見つからない。

## キーワードカバレッジ情報 \{#keyword-coverage-info\}

詳細な統計には次が含まれます：

* 入力に含まれるキーワードの総数
* 一致したキーワードの数
* カバレッジ比の算出
* 専門用語の扱い

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/keyword-coverage" />