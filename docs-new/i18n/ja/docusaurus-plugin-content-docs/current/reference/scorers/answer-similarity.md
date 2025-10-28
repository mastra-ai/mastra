---
title: "リファレンス: Answer Similarity"
description: Mastra の Answer Similarity Scorer に関するドキュメント。CI/CD テストにおいて、エージェントの出力を正解（グラウンドトゥルース）と比較します。
---

# 回答類似度スコアラー \{#answer-similarity-scorer\}

`createAnswerSimilarityScorer()` 関数は、エージェントの出力が正解とどの程度一致しているかを評価するスコアラーを作成します。このスコアラーは、期待される回答が定義されており、時間の経過に伴う一貫性を担保したい CI/CD テストのシナリオ向けに特化して設計されています。

使用例は [回答類似度の例](/docs/examples/scorers/answer-similarity) を参照してください。

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "LanguageModel",
required: true,
description: "出力と正解データの意味的な類似性を評価するために使用する言語モデル。",
},
{
name: "options",
type: "AnswerSimilarityOptions",
required: false,
description: "スコアラー用の設定オプション。",
},
]}
/>

### AnswerSimilarityOptions \{#answersimilarityoptions\}

<PropertiesTable
  content={[
{
name: "requireGroundTruth",
type: "boolean",
required: false,
defaultValue: "true",
description: "評価において ground truth（正解データ）を必須とするかどうか。false の場合、ground truth がないとスコアは 0 になります。",
},
{
name: "semanticThreshold",
type: "number",
required: false,
defaultValue: "0.8",
description: "セマンティック一致と厳密一致の相対的な重み（0〜1）。",
},
{
name: "exactMatchBonus",
type: "number",
required: false,
defaultValue: "0.2",
description: "厳密一致に対する追加スコア（0〜1）。",
},
{
name: "missingPenalty",
type: "number",
required: false,
defaultValue: "0.15",
description: "ground truth に含まれる主要概念の欠落1件ごとのペナルティ。",
},
{
name: "contradictionPenalty",
type: "number",
required: false,
defaultValue: "1.0",
description: "矛盾する情報に対するペナルティ。値を高くすると誤答のスコアがほぼ 0 に近づきます。",
},
{
name: "extraInfoPenalty",
type: "number",
required: false,
defaultValue: "0.05",
description: "ground truth にない追加情報に対する軽微なペナルティ（上限 0.2）。",
},
{
name: "scale",
type: "number",
required: false,
defaultValue: "1",
description: "スコアのスケーリング係数。",
},
]}
/>

この関数は MastraScorer クラスのインスタンスを返します。`.run()` メソッドは他のスコアラーと同じ入力を受け付けます（[MastraScorer リファレンス](./mastra-scorer)を参照）が、実行オブジェクトには ground truth の提供が必須です。

## .run() の戻り値 \{#run-returns\}

<PropertiesTable
  content={[
{
name: "runId",
type: "string",
description: "実行のID（省略可）。",
},
{
name: "score",
type: "number",
description: "0〜1（カスタムスケール使用時は0基準）の類似度スコア。スコアが高いほど、正解（ground truth）との一致度が高いことを示します。",
},
{
name: "reason",
type: "string",
description: "スコアの根拠と、改善に役立つ具体的なフィードバック（人が読める説明）。",
},
{
name: "preprocessStepResult",
type: "object",
description: "出力と正解から抽出されたセマンティックユニット。",
},
{
name: "analyzeStepResult",
type: "object",
description: "一致点・矛盾点・追加情報の詳細な分析。",
},
{
name: "preprocessPrompt",
type: "string",
description: "セマンティックユニット抽出に使用したプロンプト。",
},
{
name: "analyzePrompt",
type: "string",
description: "類似度分析に使用したプロンプト。",
},
{
name: "generateReasonPrompt",
type: "string",
description: "説明文の生成に使用したプロンプト。",
},
]}
/>

## runExperiment での使用方法 \{#usage-with-runexperiment\}

このスコアラーは、CI/CD テストで `runExperiment` と併用することを想定して設計されています。

```typescript
import { runExperiment } from '@mastra/core/scores';
import { createAnswerSimilarityScorer } from '@mastra/evals/scorers/llm';

const scorer = createAnswerSimilarityScorer({ model });

await runExperiment({
  data: [
    {
      input: 'フランスの首都はどこですか？',
      groundTruth: 'パリはフランスの首都です',
    },
  ],
  scorers: [scorer],
  target: myAgent,
  onItemComplete: ({ scorerResults }) => {
    // 類似度スコアがしきい値を満たしていることを確認
    expect(scorerResults['回答類似度スコアラー'].score).toBeGreaterThan(0.8);
  },
});
```

## 主要機能 \{#key-features\}

* **セマンティック解析**: 単純な文字列照合ではなく、LLMで意味単位を抽出して比較します
* **矛盾検出**: 事実と異なる情報を特定し、スコアを0に近づけます
* **柔軟なマッチング**: 完全一致、セマンティック一致、部分一致、未一致に対応
* **CI/CD対応**: 正解データとの比較による自動テスト向けに設計
* **行動可能なフィードバック**: 何が一致し、何を改善すべきかを具体的に説明します

## スコアリングアルゴリズム \{#scoring-algorithm\}

スコアラーは次の複数ステップで処理します:

1. **Extract**: 出力と正解を意味単位に分割する
2. **Analyze**: 単位を比較し、一致・矛盾・不足を特定する
3. **Score**: 矛盾へのペナルティを考慮して加重類似度を算出する
4. **Reason**: 人間が読める説明を生成する

スコアの計算式: `max(0, base_score - contradiction_penalty - missing_penalty - extra_info_penalty) × scale`