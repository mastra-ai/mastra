---
title: "リファレンス: runExperiment"
description: "Mastra の runExperiment 関数に関するドキュメント。複数のスコアラーを用いて、エージェントやワークフローをバッチで評価できます。"
---

# runExperiment \{#runexperiment\}

`runExperiment` 関数は、スコアラーに対して複数のテストケースを同時に実行することで、エージェントやワークフローを一括で評価できます。これは、体系的なテスト、パフォーマンス分析、AI システムの検証に不可欠です。

## 使い方の例 \{#usage-example\}

```typescript
import { runExperiment } from '@mastra/core/scores';
import { myAgent } from './agents/my-agent';
import { myScorer1, myScorer2 } from './scorers';

const result = await runExperiment({
  target: myAgent,
  data: [{ input: '機械学習とは何ですか?' }, { input: 'ニューラルネットワークを説明してください' }, { input: 'AIはどのように動作しますか?' }],
  scorers: [myScorer1, myScorer2],
  concurrency: 2,
  onItemComplete: ({ item, targetResult, scorerResults }) => {
    console.log(`完了: ${item.input}`);
    console.log(`スコア:`, scorerResults);
  },
});

console.log(`平均スコア:`, result.scores);
console.log(`${result.summary.totalItems}件のアイテムを処理しました`);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "target",
type: "Agent | Workflow",
description: "評価するエージェントまたはワークフロー。",
isOptional: false,
},
{
name: "data",
type: "RunExperimentDataItem[]",
description: "入力データと任意の正解（グラウンドトゥルース）を含むテストケースの配列。",
isOptional: false,
},
{
name: "scorers",
type: "MastraScorer[] | WorkflowScorerConfig",
description: "エージェント用のスコアラー配列、またはワークフローおよび各ステップに対するスコアラーを指定するワークフロー向けの設定オブジェクト。",
isOptional: false,
},
{
name: "concurrency",
type: "number",
description: "同時に実行するテストケース数。",
isOptional: true,
defaultValue: "1",
},
{
name: "onItemComplete",
type: "function",
description: "各テストケース完了後に呼び出されるコールバック関数。item、ターゲットの結果、スコアラーの結果を受け取ります。",
isOptional: true,
},
]}
/>

## データ項目の構成 \{#data-item-structure\}

<PropertiesTable
  content={[
{
name: "input",
type: "string | string[] | CoreMessage[] | any",
description: "ターゲットへの入力データ。エージェントの場合はメッセージまたは文字列、ワークフローの場合はワークフローの入力データ。",
isOptional: false,
},
{
name: "groundTruth",
type: "any",
description: "スコアリング時の比較用に用いる期待値または参照出力。",
isOptional: true,
},
{
name: "runtimeContext",
type: "RuntimeContext",
description: "実行時にターゲットへ渡すランタイムコンテキスト。",
isOptional: true,
},
{
name: "tracingContext",
type: "TracingContext",
description: "可観測性とデバッグのためのトレース用コンテキスト。",
isOptional: true,
},
]}
/>

## Workflow Scorer の設定 \{#workflow-scorer-configuration\}

ワークフローでは、`WorkflowScorerConfig` を使用して、さまざまなレベルでスコアラーを指定できます。

<PropertiesTable
  content={[
{
name: "workflow",
type: "MastraScorer[]",
description: "ワークフロー全体の出力を評価するためのスコアラー配列。",
isOptional: true,
},
{
name: "steps",
type: "Record<string, MastraScorer[]>",
description: "各ステップの出力を評価するために、ステップ ID をスコアラー配列に対応付けるオブジェクト。",
isOptional: true,
},
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "scores",
type: "Record<string, any>",
description: "全テストケースにおける平均スコア。各スコアラー名で集計・整理されています。",
},
{
name: "summary",
type: "object",
description: "実験実行の概要情報。",
},
{
name: "summary.totalItems",
type: "number",
description: "処理されたテストケースの総数。",
},
]}
/>

## 例 \{#examples\}

### エージェントの評価 \{#agent-evaluation\}

```typescript
import { runExperiment } from '@mastra/core/scores';
import { createScorer } from '@mastra/core/scores';

const myScorer = createScorer({
  name: 'マイスコアラー',
  description: "エージェントの応答に正解が含まれているかをチェックする",
  type: 'agent',
}).generateScore(({ run }) => {
  const response = run.output[0]?.content || '';
  const expectedResponse = run.groundTruth;
  return response.includes(expectedResponse) ? 1 : 0;
});

const result = await runExperiment({
  target: chatAgent,
  data: [
    {
      input: 'AIとは何ですか?',
      groundTruth: 'AIは知的な機械を作成するコンピュータサイエンスの分野です。',
    },
    {
      input: '機械学習はどのように動作しますか?',
      groundTruth: '機械学習はアルゴリズムを使用してデータからパターンを学習します。',
    },
  ],
  scorers: [relevancyScorer],
  concurrency: 3,
});
```

### ワークフローの評価 \{#workflow-evaluation\}

```typescript
const workflowResult = await runExperiment({
  target: myWorkflow,
  data: [
    { input: { query: 'このデータを処理する', priority: '高' } },
    { input: { query: '別のタスク', priority: '低' } },
  ],
  scorers: {
    workflow: [outputQualityScorer],
    steps: {
      'validation-step': [validationScorer],
      'processing-step': [processingScorer],
    },
  },
  onItemComplete: ({ item, targetResult, scorerResults }) => {
    console.log(`ワークフローを完了しました: ${item.input.query}`);
    if (scorerResults.workflow) {
      console.log('ワークフローのスコア:', scorerResults.workflow);
    }
    if (scorerResults.steps) {
      console.log('各ステップのスコア:', scorerResults.steps);
    }
  },
});
```

## 関連 \{#related\}

* [createScorer()](/docs/reference/scorers/create-scorer) - 実験向けのカスタムスコアラーを作成する
* [MastraScorer](/docs/reference/scorers/mastra-scorer) - スコアラーの構造とメソッドを学ぶ
* [Custom Scorers](/docs/scorers/custom-scorers) - 評価ロジック構築ガイド
* [Scorers Overview](/docs/scorers/overview) - スコアラーの基本概念を理解する