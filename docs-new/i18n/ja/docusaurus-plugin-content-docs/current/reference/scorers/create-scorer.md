---
title: "リファレンス: カスタムスコアラーの作成"
description: Mastra でカスタムスコアラーを作成するためのドキュメント。JavaScript 関数または LLM ベースのプロンプトを使って、独自の評価ロジックを定義できます。
---

# createScorer \{#createscorer\}

Mastra では、入力と出力のペアを評価するためのカスタムスコアラーを定義できる、統一的な `createScorer` ファクトリを提供しています。各評価ステップでは、ネイティブの JavaScript 関数または LLM ベースのプロンプトオブジェクトを使用できます。カスタムスコアラーは、エージェントやワークフローのステップに追加できます。

## カスタムスコアラーの作成方法 \{#how-to-create-a-custom-scorer\}

`createScorer` ファクトリを使って、名前、説明、必要に応じて judge の設定を指定し、スコアラーを定義します。続いて、ステップメソッドをチェーンして評価パイプラインを構築します。少なくとも `generateScore` ステップは必須です。

```typescript
const scorer = createScorer({
  name: 'マイカスタムスコアラー',
  description: 'カスタム基準に基づいてレスポンスを評価します',
  type: 'agent', // 任意: 自動型付けによるエージェント評価用
  judge: {
    model: myModel,
    instructions: 'あなたは評価の専門家です...',
  },
})
  .preprocess({
    /* ステップ設定 */
  })
  .analyze({
    /* ステップ設定 */
  })
  .generateScore(({ run, results }) => {
    // 数値を返す
  })
  .generateReason({
    /* ステップ設定 */
  });
```

## createScorer のオプション \{#createscorer-options\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
required: true,
description: "スコアラーの名前。",
},
{
name: "description",
type: "string",
required: true,
description: "スコアラーの機能の説明。",
},
{
name: "judge",
type: "object",
required: false,
description: "LLM ベースのステップ向けの任意の judge 設定。以下の Judge Object セクションを参照してください。",
},
{
name: "type",
type: "string",
required: false,
description: "入出力の型指定。自動エージェント型には 'agent' を使用します。カスタム型にはジェネリック手法を使用してください。",
},
]}
/>

この関数は、ステップメソッドをチェーンできるスコアラーのビルダーを返します。`.run()` メソッドとその入出力の詳細は、[MastraScorer リファレンス](./mastra-scorer)を参照してください。

## Judge オブジェクト \{#judge-object\}

<PropertiesTable
  content={[
{
name: "model",
type: "LanguageModel",
required: true,
description: "評価に使用する LLM モデルのインスタンス。",
},
{
name: "instructions",
type: "string",
required: true,
description: "LLM に対するシステムプロンプト／指示。",
},
]}
/>

## 型安全性 \{#type-safety\}

スコアラーを作成する際に入出力の型を指定すると、型推論と IntelliSense のサポートが向上します。

### エージェントタイプのショートカット \{#agent-type-shortcut\}

エージェントを評価する際は、`type: 'agent'` を使用すると、エージェントの入出力に対して正しい型が自動的に適用されます。

```typescript
import { createScorer } from '@mastra/core/scorers';

// 自動型付け対応のエージェント用スコアラー
const agentScorer = createScorer({
  name: 'エージェント応答の品質',
  description: 'エージェントの応答を評価する',
  type: 'agent', // ScorerRunInputForAgent/ScorerRunOutputForAgent を自動的に提供
})
  .preprocess(({ run }) => {
    // run.input は自動的に ScorerRunInputForAgent として型付けされます
    const userMessage = run.input.inputMessages[0]?.content;
    return { userMessage };
  })
  .generateScore(({ run, results }) => {
    // run.output は自動的に ScorerRunOutputForAgent として型付けされます
    const response = run.output[0]?.content;
    return response.length > 10 ? 1.0 : 0.5;
  });
```

### ジェネリクスを使ったカスタム型 \{#custom-types-with-generics\}

カスタムの入出力型には、ジェネリクス方式を使用します。

```typescript
import { createScorer } from '@mastra/core/scorers';

type CustomInput = { query: string; context: string[] };
type CustomOutput = { answer: string; confidence: number };

const customScorer = createScorer<CustomInput, CustomOutput>({
  name: 'カスタムスコアラー',
  description: 'カスタムデータを評価する',
}).generateScore(({ run }) => {
  // run.input は CustomInput 型です
  // run.output は CustomOutput 型です
  return run.output.confidence;
});
```

### 組み込みのエージェント型 \{#built-in-agent-types\}

* **`ScorerRunInputForAgent`** - エージェント評価に用いる `inputMessages`、`rememberedMessages`、`systemMessages`、`taggedSystemMessages` を含みます
* **`ScorerRunOutputForAgent`** - エージェントの応答メッセージの配列

これらの型を使うと、オートコンプリート、コンパイル時検証、そしてスコアリングロジックのドキュメント性が向上します。

## エージェントタイプによるトレーススコアリング \{#trace-scoring-with-agent-types\}

`type: 'agent'` を使用すると、スコアラーはエージェントへの直接追加と、エージェントのやり取りから生成されたトレースの採点の両方に対応します。スコアラーはトレースデータを自動的に適切なエージェントの入出力形式に変換します。

```typescript
const agentTraceScorer = createScorer({
  name: 'Agent Trace Length',
  description: 'エージェントの応答長を評価します',
  type: 'agent',
}).generateScore(({ run }) => {
  // トレースデータは自動的にエージェント形式へ変換されます
  const userMessages = run.input.inputMessages;
  const agentResponse = run.output[0]?.content;

  // 応答の長さに基づいてスコアを付与
  return agentResponse?.length > 50 ? 0 : 1;
});

// トレースのスコアリング用にMastraへ登録
const mastra = new Mastra({
  scorers: {
    agentTraceScorer,
  },
});
```

## Step メソッドのシグネチャ \{#step-method-signatures\}

### preprocess \{#preprocess\}

分析の前にデータを抽出または変換できる任意の前処理ステップ。

**関数モード:**
関数: `({ run, results }) => any`

<PropertiesTable
  content={[
{
name: "run.input",
type: "any",
required: true,
description: "スコアラーに渡される入力レコード。スコアラーがエージェントに追加されている場合はユーザーからのメッセージ配列（例: `[{ role: 'user', content: 'hello world' }]`）。スコアラーがワークフローで使用されている場合は、そのワークフローの入力になります。",
},
{
name: "run.output",
type: "any",
required: true,
description: "スコアラーに渡される出力レコード。エージェントの場合は通常、エージェントの応答。ワークフローの場合はワークフローの出力です。",
},
{
name: "run.runId",
type: "string",
required: true,
description: "このスコアリング実行の一意の識別子。",
},
{
name: "run.runtimeContext",
type: "object",
required: false,
description: "評価対象のエージェントまたはワークフローのステップからのランタイムコンテキスト（オプション）。",
},
{
name: "results",
type: "object",
required: true,
description: "空のオブジェクト（前段のステップはありません）。",
},
]}
/>

戻り値: `any`\
このメソッドは任意の値を返せます。返された値は後続のステップで `preprocessStepResult` として利用可能です。

**プロンプトオブジェクトモード:**

<PropertiesTable
  content={[
{
name: "description",
type: "string",
required: true,
description: "この前処理ステップの内容の説明。",
},
{
name: "outputSchema",
type: "ZodSchema",
required: true,
description: "preprocess ステップの期待される出力に対する Zod スキーマ。",
},
{
name: "createPrompt",
type: "function",
required: true,
description: "関数: ({ run, results }) => string。LLM に渡すプロンプトを返します。",
},
{
name: "judge",
type: "object",
required: false,
description: "（オプション）このステップ用の LLM ジャッジ（メインのジャッジを上書き可能）。Judge Object のセクションを参照。",
},
]}
/>

### analyze \{#analyze\}

入力/出力および前処理済みデータ（任意）を処理するオプションの分析ステップ。

**Function Mode:**
Function: `({ run, results }) => any`

<PropertiesTable
  content={[
{
name: "run.input",
type: "any",
required: true,
description: "スコアラーに渡される入力レコード。スコアラーがエージェントに追加されている場合は、ユーザーからのメッセージ配列（例: `[{ role: 'user', content: 'hello world' }]`）になります。スコアラーがワークフローで使用される場合は、ワークフローの入力になります。",
},
{
name: "run.output",
type: "any",
required: true,
description: "スコアラーに渡される出力レコード。エージェントの場合は通常、エージェントの応答です。ワークフローの場合は、ワークフローの出力です。",
},
{
name: "run.runId",
type: "string",
required: true,
description: "このスコアリング実行の一意の識別子。",
},
{
name: "run.runtimeContext",
type: "object",
required: false,
description: "評価対象のエージェントまたはワークフローステップから提供されるランタイムコンテキスト（任意）。",
},
{
name: "results.preprocessStepResult",
type: "any",
required: false,
description: "preprocess ステップの結果（定義されている場合、任意）。",
},
]}
/>

Returns: `any`\
このメソッドは任意の値を返せます。返された値は後続のステップで `analyzeStepResult` として利用可能です。

**Prompt Object Mode:**

<PropertiesTable
  content={[
{
name: "description",
type: "string",
required: true,
description: "この分析ステップの内容・目的の説明。",
},
{
name: "outputSchema",
type: "ZodSchema",
required: true,
description: "analyze ステップで想定される出力の Zod スキーマ。",
},
{
name: "createPrompt",
type: "function",
required: true,
description: "Function: ({ run, results }) => string。LLM に渡すプロンプトを返します。",
},
{
name: "judge",
type: "object",
required: false,
description: "（任意）このステップ用の LLM ジャッジ（メインのジャッジを上書き可能）。「Judge Object」セクションを参照。",
},
]}
/>

### generateScore \{#generatescore\}

最終的な数値スコアを算出する**必須**ステップ。

**Function モード:**
Function: `({ run, results }) => number`

<PropertiesTable
  content={[
{
name: "run.input",
type: "any",
required: true,
description: "スコアラーに渡される入力レコード。スコアラーがエージェントに追加されている場合はユーザーメッセージの配列（例: `[{ role: 'user', content: 'hello world' }]`）。スコアラーがワークフローで使用される場合は、ワークフローの入力になります。",
},
{
name: "run.output",
type: "any",
required: true,
description: "スコアラーに渡される出力レコード。エージェントの場合は通常、エージェントの応答です。ワークフローの場合はワークフローの出力です。",
},
{
name: "run.runId",
type: "string",
required: true,
description: "このスコアリング実行の一意の識別子。",
},
{
name: "run.runtimeContext",
type: "object",
required: false,
description: "評価対象のエージェントまたはワークフローステップのランタイムコンテキスト（任意）。",
},
{
name: "results.preprocessStepResult",
type: "any",
required: false,
description: "preprocess ステップの結果（定義されている場合、任意）。",
},
{
name: "results.analyzeStepResult",
type: "any",
required: false,
description: "analyze ステップの結果（定義されている場合、任意）。",
},
]}
/>

Returns: `number`\
このメソッドは数値スコアを返す必要があります。

**Prompt Object モード:**

<PropertiesTable
  content={[
{
name: "description",
type: "string",
required: true,
description: "このスコアリングステップの説明。",
},
{
name: "outputSchema",
type: "ZodSchema",
required: true,
description: "generateScore ステップの想定される出力のための Zod スキーマ。",
},
{
name: "createPrompt",
type: "function",
required: true,
description: "Function: ({ run, results }) => string。LLM に渡すプロンプトを返します。",
},
{
name: "judge",
type: "object",
required: false,
description: "（任意）このステップ用の LLM ジャッジ（メインのジャッジを上書き可能）。Judge Object セクションを参照。",
},
]}
/>

Prompt Object モードを使用する場合は、LLM の出力を数値スコアに変換するための `calculateScore` 関数も提供する必要があります:

<PropertiesTable
  content={[
{
name: "calculateScore",
type: "function",
required: true,
description: "Function: ({ run, results, analyzeStepResult }) => number。LLM の構造化出力を数値スコアに変換します。",
},
]}
/>

### generateReason \{#generatereason\}

スコアに対する説明を提供する任意のステップ。

**関数モード:**
関数: `({ run, results, score }) => string`

<PropertiesTable
  content={[
{
name: "run.input",
type: "any",
required: true,
description: "スコアラーに渡される入力レコード。スコアラーがエージェントに追加されている場合は、ユーザーメッセージの配列（例: `[{ role: 'user', content: 'hello world' }]`）。スコアラーがワークフローで使用される場合は、ワークフローの入力。",
},
{
name: "run.output",
type: "any",
required: true,
description: "スコアラーに渡される出力レコード。エージェントの場合は通常、エージェントの応答。ワークフローの場合は、ワークフローの出力。",
},
{
name: "run.runId",
type: "string",
required: true,
description: "このスコアリング実行の一意の識別子。",
},
{
name: "run.runtimeContext",
type: "object",
required: false,
description: "評価対象のエージェントまたはワークフローステップからのランタイムコンテキスト（任意）。",
},
{
name: "results.preprocessStepResult",
type: "any",
required: false,
description: "preprocess ステップの結果（定義されている場合、任意）。",
},
{
name: "results.analyzeStepResult",
type: "any",
required: false,
description: "analyze ステップの結果（定義されている場合、任意）。",
},
{
name: "score",
type: "number",
required: true,
description: "generateScore ステップで算出されたスコア。",
},
]}
/>

戻り値: `string`\
このメソッドはスコアの根拠を説明する文字列を返す必要があります。

**プロンプトオブジェクトモード:**

<PropertiesTable
  content={[
{
name: "description",
type: "string",
required: true,
description: "この推論ステップの役割の説明。",
},
{
name: "createPrompt",
type: "function",
required: true,
description: "関数: ({ run, results, score }) => string。LLM に渡すプロンプトを返します。",
},
{
name: "judge",
type: "object",
required: false,
description: "（任意）このステップ用の LLM ジャッジ（メインのジャッジを上書き可能）。Judge Object セクションを参照。",
},
]}
/>

すべてのステップ関数は非同期にできます。