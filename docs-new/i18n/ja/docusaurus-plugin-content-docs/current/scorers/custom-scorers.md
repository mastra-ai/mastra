---
title: スコアラーの作成
sidebar_position: 3
---

## スコアラーの作成 \{#creating-scorers\}

Mastra には、各ステップで JavaScript 関数または LLM ベースのプロンプトオブジェクトを用いてカスタム評価ロジックを構築できる、統一的な `createScorer` ファクトリが用意されています。これにより、評価パイプラインの各段階に最適なアプローチを柔軟に選択できます。

### 4ステップのパイプライン \{#the-four-step-pipeline\}

Mastraのすべてのスコアラーは、一貫した4ステップの評価パイプラインに従います:

1. **preprocess**（任意）：入力・出力データを準備または変換する
2. **analyze**（任意）：評価のための分析を行い、洞察を得る
3. **generateScore**（必須）：分析結果を数値スコアに変換する
4. **generateReason**（任意）：人間が読める説明を生成する

各ステップでは、**functions** または **prompt objects**（LLMベースの評価）のいずれかを使用でき、必要に応じて決定的なアルゴリズムとAIの判断を柔軟に組み合わせられます。

### 関数 vs プロンプトオブジェクト \{#functions-vs-prompt-objects\}

**関数** は決定的なロジックに JavaScript を使用します。次の用途に最適です:

* 明確な基準に基づくアルゴリズム評価
* パフォーマンスが重要なシナリオ
* 既存ライブラリとの統合
* 一貫して再現可能な結果

**プロンプトオブジェクト** は評価の審査に LLM を用います。次の用途に最適です:

* 人間に近い判断が求められる主観的な評価
* アルゴリズムでは実装しづらい複雑な基準
* 自然言語理解タスク
* 文脈の微妙なニュアンスの評価

1 つのスコアラー内でアプローチを組み合わせられます。たとえば、データの前処理に関数を使い、品質の分析に LLM を使うことができます。

### スコアラーの初期化 \{#initializing-a-scorer\}

すべてのスコアラーは `createScorer` というファクトリ関数から始まります。名前と説明は必須で、タイプ仕様とジャッジ設定は任意です。

```typescript
import { createScorer } from '@mastra/core/scores';
import { openai } from '@ai-sdk/openai';

const glutenCheckerScorer = createScorer({
  name: 'グルテンチェッカー',
  description: 'レシピにグルテン成分が含まれているかチェックする',
  judge: {                    // オプション: プロンプトオブジェクトステップ用
    model: openai('gpt-4o'),
    instructions: 'あなたはレシピにグルテンが含まれているかを判定するシェフです。'
  }
})
// ステップメソッドをここでチェーンする
.preprocess(...)
.analyze(...)
.generateScore(...)
.generateReason(...)
```

judge 構成は、いずれかのステップで prompt オブジェクトを使用する場合にのみ必要です。各ステップは、独自の judge 設定でこの既定の構成を上書きできます。

#### エージェント評価用のエージェントタイプ \{#agent-type-for-agent-evaluation\}

型安全性を保ち、ライブエージェントのスコアリングとトレーススコアリングの双方に対応するため、エージェント評価用のスコアラーを作成する際は `type: 'agent'` を使用してください。これにより、同じスコアラーをエージェントに対してもトレースに対しても利用できます。

```typescript
const myScorer = createScorer({
  // ...
  type: 'agent', // エージェントの入出力型を自動的に処理
}).generateScore(({ run, results }) => {
  // run.output は自動的に ScorerRunOutputForAgent 型として扱われます
  // run.input は自動的に ScorerRunInputForAgent 型として扱われます
});
```

### 手順ごとの分解 \{#step-by-step-breakdown\}

#### preprocess ステップ（オプション） \{#preprocess-step-optional\}

特定の要素を抽出したり、コンテンツをフィルタリングしたり、複雑なデータ構造を変換したりする必要がある場合に、入出力データを準備します。

**関数:** `({ run, results }) => any`

```typescript
const glutenCheckerScorer = createScorer(...)
.preprocess(({ run }) => {
  // レシピテキストを抽出してクリーンアップする
  const recipeText = run.output.text.toLowerCase();
  const wordCount = recipeText.split(' ').length;

  return {
    recipeText,
    wordCount,
    hasCommonGlutenWords: /flour|wheat|bread|pasta/.test(recipeText)
  };
})
```

**プロンプトオブジェクト:** LLM ベースの前処理を構造化するために `description`、`outputSchema`、`createPrompt` を使用します。

```typescript
const glutenCheckerScorer = createScorer(...)
.preprocess({
  description: 'レシピから材料を抽出',
  outputSchema: z.object({
    ingredients: z.array(z.string()),
    cookingMethods: z.array(z.string())
  }),
  createPrompt: ({ run }) => `
    このレシピからすべての材料と調理方法を抽出:
    ${run.output.text}

    ingredientsとcookingMethodsの配列を含むJSONを返す。
  `
})
```

**データフロー:** 結果は後続のステップで `results.preprocessStepResult` として使用できます

#### analyze ステップ（オプション） \{#analyze-step-optional\}

スコア決定の根拠となる洞察を得るために、評価の中核となる分析を実行します。

**Functions:** `({ run, results }) => any`

```typescript
const glutenCheckerScorer = createScorer({...})
.preprocess(...)
.analyze(({ run, results }) => {
  const { recipeText, hasCommonGlutenWords } = results.preprocessStepResult;

  // シンプルなグルテン検出アルゴリズム
  const glutenKeywords = ['wheat', 'flour', 'barley', 'rye', 'bread'];
  const foundGlutenWords = glutenKeywords.filter(word =>
    recipeText.includes(word)
  );

  return {
    isGlutenFree: foundGlutenWords.length === 0,
    detectedGlutenSources: foundGlutenWords,
    confidence: hasCommonGlutenWords ? 0.9 : 0.7
  };
})
```

**プロンプトオブジェクト:** LLM ベースの分析には `description`、`outputSchema`、`createPrompt` を使用します。

```typescript
const glutenCheckerScorer = createScorer({...})
.preprocess(...)
.analyze({
  description: 'レシピのグルテン含有量を分析',
  outputSchema: z.object({
    isGlutenFree: z.boolean(),
    glutenSources: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  }),
  createPrompt: ({ run, results }) => `
    このレシピのグルテン含有量を分析してください:
    "${results.preprocessStepResult.recipeText}"

    小麦、大麦、ライ麦、および醤油などの隠れた原材料を確認してください。
    isGlutenFree、glutenSources配列、confidence(0-1)を含むJSONを返してください。
  `
})
```

**データフロー：** 結果は後続のステップで `results.analyzeStepResult` として参照できます

#### generateScore ステップ（必須） \{#generatescore-step-required\}

分析結果を数値スコアに変換します。これはパイプラインで唯一の必須ステップです。

**Functions:** `({ run, results }) => number`

```typescript
const glutenCheckerScorer = createScorer({...})
.preprocess(...)
.analyze(...)
.generateScore(({ results }) => {
  const { isGlutenFree, confidence } = results.analyzeStepResult;

  // グルテンフリーの場合は1、グルテンを含む場合は0を返す
  // 信頼度で重み付け
  return isGlutenFree ? confidence : 0;
})
```

**プロンプトオブジェクト:** 必須の `calculateScore` 関数を含む、`generateScore` でのプロンプトオブジェクトの使用方法の詳細は、[`createScorer`](/docs/reference/scorers/create-scorer) の API リファレンスをご覧ください。

**データフロー:** スコアは `generateReason` で `score` パラメータとして利用できます

#### generateReason ステップ（オプション） \{#generatereason-step-optional\}

スコアの根拠を人間が理解しやすい形で生成します。デバッグ、透明性の向上、ユーザーへのフィードバックに有用です。

**関数:** `({ run, results, score }) => string`

```typescript
const glutenCheckerScorer = createScorer({...})
.preprocess(...)
.analyze(...)
.generateScore(...)
.generateReason(({ results, score }) => {
  const { isGlutenFree, glutenSources } = results.analyzeStepResult;

  if (isGlutenFree) {
    return `スコア: ${score}。このレシピはグルテンフリーで、有害な成分は検出されませんでした。`;
  } else {
    return `スコア: ${score}。以下の原料にグルテンが含まれています: ${glutenSources.join(', ')}`;
  }
})
```

**プロンプトオブジェクト:** LLM が生成する説明には `description` と `createPrompt` を使用してください。

```typescript
const glutenCheckerScorer = createScorer({...})
.preprocess(...)
.analyze(...)
.generateScore(...)
.generateReason({
  description: 'グルテン評価の説明',
  createPrompt: ({ results, score }) => `
    このレシピが${score}のスコアを獲得した理由を説明してください。
    Analysis: ${JSON.stringify(results.analyzeStepResult)}

    食事制限がある方にわかりやすく説明してください。
  `
})
```

**例とリソース:**

* [カスタムスコアラーの例](/docs/examples/scorers/custom-scorer) - 手順の完全な解説
* [createScorer API リファレンス](/docs/reference/scorers/create-scorer) - 技術仕様の完全版ドキュメント
* [組み込みスコアラーのソースコード](https://github.com/mastra-ai/mastra/tree/main/packages/evals/src/scorers) - 参照用の実装
