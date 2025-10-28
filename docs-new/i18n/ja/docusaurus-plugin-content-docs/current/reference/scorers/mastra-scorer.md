---
title: "リファレンス: MastraScorer"
description: Mastra の基底クラスである MastraScorer のドキュメント。カスタムおよび組み込みのあらゆるスコアラーの土台となります。
---

# MastraScorer \{#mastrascorer\}

`MastraScorer` クラスは、Mastra におけるすべてのスコアラーの基底クラスです。入力と出力のペアを評価するための標準的な `.run()` メソッドを提供し、preprocess → analyze → generateScore → generateReason の実行フローによる多段階のスコアリングワークフローをサポートします。

**注:** ほとんどのユーザーはスコアラーのインスタンスを作成する際、[`createScorer`](./create-scorer) の使用を推奨します。`MastraScorer` を直接インスタンス化することは推奨されません。

## MastraScorer インスタンスの取得方法 \{#how-to-get-a-mastrascorer-instance\}

`createScorer` ファクトリ関数を使用します。これにより `MastraScorer` インスタンスが返されます。

```typescript
const scorer = createScorer({
  name: 'My Custom Scorer',
  description: 'カスタム基準に基づいてレスポンスを評価します',
}).generateScore(({ run, results }) => {
  // スコアリングロジック
  return 0.85;
});

// scorer は MastraScorer インスタンスです
```

## .run() メソッド \{#run-method\}

`.run()` メソッドは、スコアラーを実行して入出力ペアを評価するための主な方法です。定義したステップ（preprocess → analyze → generateScore → generateReason）に従ってデータを処理し、スコア、理由付け、および中間結果を含む包括的な結果オブジェクトを返します。

```typescript
const result = await scorer.run({
  input: '機械学習とは何ですか？',
  output: '機械学習は人工知能のサブセットです...',
  runId: 'optional-run-id',
  runtimeContext: {
    /* オプションのコンテキスト */
  },
});
```

## .run() の入力 \{#run-input\}

<PropertiesTable
  content={[
{
name: "input",
type: "any",
required: true,
description: "評価対象の入力データ。スコアラーの要件に応じてあらゆる型を使用できます。",
},
{
name: "output",
type: "any",
required: true,
description: "評価対象の出力データ。スコアラーの要件に応じてあらゆる型を使用できます。",
},
{
name: "runId",
type: "string",
required: false,
description: "このスコアリング実行のための任意の一意の識別子。",
},
{
name: "runtimeContext",
type: "any",
required: false,
description: "評価対象のエージェントまたはワークフローのステップからの任意の実行時コンテキスト。",
},
{
name: "groundTruth",
type: "any",
required: false,
description: "スコアリング時の比較に用いる任意の想定出力または参照出力。runExperiment を使用する場合は自動的に渡されます。",
},
]}
/>

## .run() の戻り値 \{#run-returns\}

<PropertiesTable
  content={[
{
name: "runId",
type: "string",
description: "このスコアリング実行の一意な識別子。",
},
{
name: "score",
type: "number",
description: "generateScore ステップで算出された数値スコア。",
},
{
name: "reason",
type: "string",
description: "スコアの説明（generateReason ステップが定義されている場合。任意）。",
},
{
name: "preprocessStepResult",
type: "any",
description: "preprocess ステップの結果（定義されている場合。任意）。",
},
{
name: "analyzeStepResult",
type: "any",
description: "analyze ステップの結果（定義されている場合。任意）。",
},
{
name: "preprocessPrompt",
type: "string",
description: "preprocess 用のプロンプト（定義されている場合。任意）。",
},
{
name: "analyzePrompt",
type: "string",
description: "analyze 用のプロンプト（定義されている場合。任意）。",
},
{
name: "generateScorePrompt",
type: "string",
description: "スコア生成用のプロンプト（定義されている場合。任意）。",
},
{
name: "generateReasonPrompt",
type: "string",
description: "理由生成用のプロンプト（定義されている場合。任意）。",
},
]}
/>

## ステップの実行フロー \{#step-execution-flow\}

`.run()` を呼び出すと、MastraScorer は以下の順序で定義されたステップを実行します:

1. **preprocess**（任意）- データを抽出・変換する
2. **analyze**（任意）- 入力／出力および前処理済みデータを処理する
3. **generateScore**（必須）- 数値スコアを算出する
4. **generateReason**（任意）- スコアの理由を提示する

各ステップは前のステップの結果を受け取り、複雑な評価パイプラインを構築できます。

## 使い方の例 \{#usage-example\}

```typescript
const scorer = createScorer({
  name: '品質スコアラー',
  description: 'レスポンスの品質を評価します',
})
  .preprocess(({ run }) => {
    // 重要な情報を抽出
    return { wordCount: run.output.split(' ').length };
  })
  .analyze(({ run, results }) => {
    // レスポンスを分析
    const hasSubstance = results.preprocessStepResult.wordCount > 10;
    return { hasSubstance };
  })
  .generateScore(({ results }) => {
    // スコアを計算
    return results.analyzeStepResult.hasSubstance ? 1.0 : 0.0;
  })
  .generateReason(({ score, results }) => {
    // スコアの説明を生成
    const wordCount = results.preprocessStepResult.wordCount;
    return `スコア: ${score}。レスポンスは${wordCount}単語です。`;
  });

// スコアラーを使用
const result = await scorer.run({
  input: '機械学習とは何ですか?',
  output: '機械学習は人工知能のサブセットです...',
});

console.log(result.score); // 1.0
console.log(result.reason); // "スコア: 1.0。レスポンスは12単語です。"
```

## 統合 \{#integration\}

MastraScorer インスタンスは、エージェントやワークフローの各ステップで使用できます。

カスタムのスコアリングロジックの定義についての詳細は、[createScorer リファレンス](./create-scorer)を参照してください。