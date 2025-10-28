---
title: "テキスト差分"
description: 文字列のシーケンス差分と変更を分析し、テキスト間の類似度を評価するために Textual Difference スコアラーを用いる例。
---

# テキスト差分スコアラー \{#textual-difference-scorer\}

`createTextualDifferenceScorer` を使用して、シーケンスの差分や編集操作を解析し、2 つのテキスト文字列の類似度を評価します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

> API の詳細なドキュメントおよび設定オプションについては、[`createTextualDifferenceScorer`](/docs/reference/scorers/textual-difference)を参照してください。

## 差分なしの例 \{#no-differences-example\}

この例では、テキストはまったく同じです。スコアラーは完全一致として満点を付け、変更点は検出されません。

```typescript filename="src/example-no-differences.ts" showLineNumbers copy
import { createTextualDifferenceScorer } from '@mastra/evals/scorers/code';

const scorer = createTextualDifferenceScorer();

const input = '素早い茶色のキツネが怠惰な犬を飛び越える';
const output = '素早い茶色のキツネが怠惰な犬を飛び越える';

const result = await scorer.run({
  input: [{ role: 'user', content: input }],
  output: { role: 'assistant', text: output },
});

console.log('スコア:', result.score);
console.log('分析ステップ結果:', result.analyzeStepResult);
```

### 差分は出力されません \{#no-differences-output\}

スコアラーは高スコアを返し、テキストが同一であることを示します。詳細情報でも変更がゼロで、長さの差もないことが確認されます。

```typescript
{
  score: 1,
  analyzeStepResult: {
    confidence: 1,
    ratio: 1,
    changes: 0,
    lengthDiff: 0,
  },
}
```

## 軽微な差異の例 \{#minor-differences-example\}

この例では、テキストにわずかな違いがあります。スコアラーはこれらの軽微な差異を検出し、類似度は中程度という評価を返します。

```typescript filename="src/example-minor-differences.ts" showLineNumbers copy
import { createTextualDifferenceScorer } from '@mastra/evals/scorers/code';

const scorer = createTextualDifferenceScorer();

const input = 'こんにちは!お元気ですか?';
const output = 'やあ!調子はどう?';

const result = await scorer.run({
  input: [{ role: 'user', content: input }],
  output: { role: 'assistant', text: output },
});

console.log('スコア:', result.score);
console.log('分析ステップ結果:', result.analyzeStepResult);
```

### 細かな差分の出力 \{#minor-differences-output\}

スコアラーは、テキスト間の小さな差異を反映した中程度のスコアを返します。詳細情報には、変更数と長さの差分が含まれます。

```typescript
{
  score: 0.5925925925925926,
  analyzeStepResult: {
    confidence: 0.8620689655172413,
    ratio: 0.5925925925925926,
    changes: 5,
    lengthDiff: 0.13793103448275862
  }
}
```

## 大きな差異の例 \{#major-differences-example\}

この例では、テキスト内容が大きく異なります。スコアラーは広範な変更を検出し、低い類似度スコアを返します。

```typescript filename="src/example-major-differences.ts" showLineNumbers copy
import { createTextualDifferenceScorer } from '@mastra/evals/scorers/code';

const scorer = createTextualDifferenceScorer();

const input = 'Pythonは高水準プログラミング言語です';
const output = 'JavaScriptはWeb開発に使用されます';

const result = await scorer.run({
  input: [{ role: 'user', content: input }],
  output: { role: 'assistant', text: output },
});

console.log('スコア:', result.score);
console.log('分析ステップ結果:', result.analyzeStepResult);
```

### 主要な差分の出力 \{#major-differences-output\}

テキスト間に大きな差異があるため、scorer は低スコアを返します。詳細な `analyzeStepResult` には多数の変更点と、顕著な長さの違いが示されています。

```typescript
{
  score: 0.3170731707317073,
  analyzeStepResult: {
    confidence: 0.8636363636363636,
    ratio: 0.3170731707317073,
    changes: 8,
    lengthDiff: 0.13636363636363635
  }
}
```

## スコアラーの設定 \{#scorer-configuration\}

`TextualDifferenceScorer` インスタンスはデフォルト設定で作成できます。追加の設定は不要です。

```typescript
const scorer = createTextualDifferenceScorer();
```

> 設定オプションの一覧は [TextualDifferenceScorer](/docs/reference/scorers/textual-difference) を参照してください。

## 結果の理解 \{#understanding-the-results\}

`.run()` は次の形式の結果を返します:

```typescript
{
  runId: 文字列,
  analyzeStepResult: {
    confidence: 数値,
    ratio: 数値,
    changes: 数値,
    lengthDiff: 数値
  },
  score: 数値
}
```

### score \{#score\}

0〜1 の範囲のテキスト差分スコア:

* **1.0**: テキストは同一 — 差分なし。
* **0.7〜0.9**: 軽微な差異 — わずかな変更が必要。
* **0.4〜0.6**: 中程度の差異 — 目立つ変更が必要。
* **0.1〜0.3**: 大きな差異 — 大幅な変更が必要。
* **0.0**: まったく異なるテキスト。

### runId \{#runid\}

このスコアラーの実行を一意に識別する ID です。

### analyzeStepResult \{#analyzestepresult\}

差分メトリクスを持つオブジェクト：

* **confidence**: 長さの差に基づく信頼スコア（高いほど良い）。
* **ratio**: テキスト間の類似度（0〜1）。
* **changes**: テキストを一致させるのに必要な編集操作の数。
* **lengthDiff**: テキスト長の正規化済み差分。

<GithubLink marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/scorers/textual-difference" />