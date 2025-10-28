---
title: "キーワード網羅度"
description: 入力テキストの重要なキーワードがどの程度カバーされているかを評価するために、Keyword Coverage スコアラーを使用する例。
---

# キーワード網羅スコアラー \{#keyword-coverage-scorer\}

`createKeywordCoverageScorer` を使用して、コンテキストに含まれる必須のキーワードやフレーズが、レスポンスにどれだけ正確に含まれているかを評価します。スコアラーは `query` と `response` を受け取り、スコアと、キーワード一致の統計情報を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

> API の詳細なドキュメントと構成オプションについては、[`createKeywordCoverageScorer`](/docs/reference/scorers/keyword-coverage)を参照してください。

## 完全カバレッジの例 \{#full-coverage-example\}

この例では、応答が入力の主要な用語をすべて忠実に反映しています。必要なキーワードがすべて含まれており、抜け漏れのない完全なカバレッジになっています。

```typescript filename="src/example-full-keyword-coverage.ts" showLineNumbers copy
import { createKeywordCoverageScorer } from '@mastra/evals/scorers/code';

const scorer = createKeywordCoverageScorer();

const input = 'ReactやVueのようなJavaScriptフレームワーク';
const output = '人気のJavaScriptフレームワークには、Web開発向けのReactやVueがあります';

const result = await scorer.run({
  input: [{ role: 'user', content: input }],
  output: { role: 'assistant', text: output },
});

console.log('スコア:', result.score);
console.log('分析ステップ結果:', result.analyzeStepResult);
```

### フルカバレッジ出力 \{#full-coverage-output\}

スコアが1の場合、期待されるすべてのキーワードがレスポンス内で見つかったことを示します。`analyzeStepResult` フィールドは、一致したキーワード数が入力から抽出された総数と等しいことを確認します。

```typescript
{
  score: 1,
  analyzeStepResult: {
    totalKeywords: 4,
    matchedKeywords: 4
  }
}
```

## 部分的カバレッジの例 \{#partial-coverage-example\}

この例では、レスポンスに入力の重要なキーワードの一部は含まれているものの、すべては網羅されていません。スコアは部分的なカバレッジを反映しており、重要な用語が欠落しているか、あるいは一部しか一致していないことを示します。

```typescript filename="src/example-partial-keyword-coverage.ts" showLineNumbers copy
import { createKeywordCoverageScorer } from '@mastra/evals/scorers/code';

const scorer = createKeywordCoverageScorer();

const input = 'TypeScriptはインターフェース、ジェネリクス、型推論を提供します';
const output = 'TypeScriptは型推論といくつかの高度な機能を提供します';

const result = await scorer.run({
  input: [{ role: 'user', content: input }],
  output: { role: 'assistant', text: output },
});

console.log('スコア:', result.score);
console.log('分析ステップ結果:', result.analyzeStepResult);
```

### 部分的なカバレッジの出力 \{#partial-coverage-output\}

スコアが 0.5 の場合、期待されるキーワードのうち半分しかレスポンス内で見つからなかったことを示します。`analyzeStepResult` フィールドは、入力で特定された総数に対して、いくつの用語が一致したかを示します。

```typescript
{
  score: 0.5,
  analyzeStepResult: {
    totalKeywords: 6,
    matchedKeywords: 3
  }
}
```

## カバレッジが最小の例 \{#minimal-coverage-example\}

この例では、応答に入力の重要なキーワードがほとんど含まれていません。スコアはカバレッジの最小度合いを反映しており、主要な用語の大半が欠落しているか反映されていません。

```typescript filename="src/example-minimal-keyword-coverage.ts" showLineNumbers copy
import { createKeywordCoverageScorer } from '@mastra/evals/scorers/code';

const scorer = createKeywordCoverageScorer();

const input = '機械学習モデルには、データの前処理、特徴量エンジニアリング、ハイパーパラメータチューニングが必要です';
const output = 'データの準備はモデルにとって重要です';

const result = await scorer.run({
  input: [{ role: 'user', content: input }],
  output: { role: 'assistant', text: output },
});

console.log('スコア:', result.score);
console.log('分析ステップ結果:', result.analyzeStepResult);
```

### カバレッジが最小の出力 \{#minimal-coverage-output\}

スコアが低い場合、期待されるキーワードのうちごくわずかしか応答に含まれていないことを示します。`analyzeStepResult` フィールドは、総キーワード数と一致キーワード数の差分を可視化し、カバレッジ不足を示します。

```typescript
{
  score: 0.2,
  analyzeStepResult: {
    totalKeywords: 10,
    matchedKeywords: 2
  }
}
```

## メトリクスの構成 \{#metric-configuration\}

`KeywordCoverageMetric` インスタンスはデフォルト設定のまま作成できます。追加の構成は不要です。

```typescript
const metric = new KeywordCoverageMetric();
```

> 設定オプションの完全な一覧は、[KeywordCoverageScorer](/docs/reference/scorers/keyword-coverage)を参照してください。

## 結果の理解 \{#understanding-the-results\}

`.run()` は次の形の結果を返します：

```typescript
{
  runId: string,
  extractStepResult: {
    referenceKeywords: Set<string>,
    responseKeywords: Set<string>
  },
  analyzeStepResult: {
    totalKeywords: number,
    matchedKeywords: number
  },
  score: number
}
```

### スコア \{#score\}

0〜1 の範囲のカバレッジスコア:

* **1.0**: 完全にカバー — すべてのキーワードが含まれる。
* **0.7〜0.9**: 高いカバー率 — ほとんどのキーワードが含まれる。
* **0.4〜0.6**: 部分的にカバー — いくつかのキーワードが含まれる。
* **0.1〜0.3**: 低いカバー率 — 一部のキーワードのみ一致。
* **0.0**: カバーなし — キーワードが見つからない。

### runId \{#runid\}

このスコアラーの実行を一意に識別する ID です。

### extractStepResult \{#extractstepresult\}

抽出されたキーワードを含むオブジェクト：

* **referenceKeywords**：入力から抽出されたキーワードの集合
* **responseKeywords**：出力から抽出されたキーワードの集合

### analyzeStepResult \{#analyzestepresult\}

キーワード網羅率の統計を持つオブジェクト:

* **totalKeywords**: 想定されるキーワードの数（入力に基づく）。
* **matchedKeywords**: レスポンス内で見つかったキーワードの数。

<GithubLink marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/scorers/keyword-coverage" />