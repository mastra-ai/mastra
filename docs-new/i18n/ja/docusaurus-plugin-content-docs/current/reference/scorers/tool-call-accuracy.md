---
title: "リファレンス: ツール呼び出し精度"
description: Mastra のツール呼び出し精度スコアラーに関するドキュメント。利用可能な選択肢の中から、LLM の出力が適切なツールを正しく呼び出しているかを評価します。
---

# ツール呼び出し精度スコアラー \{#tool-call-accuracy-scorers\}

Mastra は、LLM が利用可能な選択肢から適切なツールを選べているかを評価するために、次の 2 種類のツール呼び出し精度スコアラーを提供しています：

1. **コードベースのスコアラー** - ツールの完全一致に基づく決定的な評価
2. **LLM ベースのスコアラー** - AI による意味的評価で適切さを判定

使用例については、[Tool Call Accuracy Examples](/docs/examples/scorers/tool-call-accuracy) を参照してください。

## コードベースのツール呼び出し精度スコアラー \{#code-based-tool-call-accuracy-scorer\}

`@mastra/evals/scorers/code` の `createToolCallAccuracyScorerCode()` 関数は、ツールの厳密一致に基づく決定的な二値スコアリングを提供し、厳密評価と寛容評価の両モードに対応するとともに、ツール呼び出し順序の検証もサポートします。

### パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "expectedTool",
type: "string",
description: "指定されたタスクで呼び出すべきツール名。expectedToolOrder が指定されている場合は無視されます。",
required: false,
},
{
name: "strictMode",
type: "boolean",
description: "評価の厳密さを制御します。単一ツールモード: 完全一致する単一のツール呼び出しのみを許可します。順序チェックモード: 余分なツールを許可せず、ツールは正確に一致している必要があります。",
required: false,
default: "false",
},
{
name: "expectedToolOrder",
type: "string[]",
description: "期待される呼び出し順のツール名の配列。指定された場合、順序チェックモードが有効になり、expectedTool パラメータは無視されます。",
required: false,
},
]}
/>

この関数は MastraScorer クラスのインスタンスを返します。`.run()` メソッドとその入出力の詳細は [MastraScorer リファレンス](./mastra-scorer) を参照してください。

### 評価モード \{#evaluation-modes\}

コードベースのスコアラーは、2 つの異なるモードで動作します。

#### シングルツールモード \{#single-tool-mode\}

`expectedToolOrder` が指定されていない場合、スコアラーは単一のツール選択を評価します：

* **標準モード (strictMode: false)**: 他のツールが呼び出されていても、期待されるツールが呼び出されていれば `1` を返します
* **厳格モード (strictMode: true)**: 呼び出されたツールがちょうど1つで、かつそれが期待されるツールと一致する場合にのみ `1` を返します

#### 順序チェックモード \{#order-checking-mode\}

`expectedToolOrder` が指定されている場合、スコアラーはツール呼び出しの順序を検証します：

* **厳密な順序（strictMode: true）**: 追加のツールを挟まず、指定された順序どおりに正確に呼び出す必要があります
* **柔軟な順序（strictMode: false）**: 期待されるツールが相対的な順序を守っていればよく（追加のツールは許可）

### 例 \{#examples\}

```typescript
import { createToolCallAccuracyScorerCode } from '@mastra/evals/scorers/code';

// 単一ツールの検証
const scorer = createToolCallAccuracyScorerCode({
  expectedTool: 'weather-tool',
});

// 厳格な単一ツール（他のツールは許可されない）
const strictScorer = createToolCallAccuracyScorerCode({
  expectedTool: 'calculator-tool',
  strictMode: true,
});

// ツールの順序を検証
const orderScorer = createToolCallAccuracyScorerCode({
  expectedTool: 'search-tool', // 順序が指定されている場合は無視される
  expectedToolOrder: ['search-tool', 'weather-tool'],
  strictMode: true, // 完全一致が必要
});
```

## LLMベースのツール呼び出し精度スコアラー \{#llm-based-tool-call-accuracy-scorer\}

`@mastra/evals/scorers/llm` の `createToolCallAccuracyScorerLLM()` 関数は、エージェントが呼び出したツールがユーザーの要求に対して適切かどうかを LLM で評価し、厳密な一致ではなく意味的な評価を行います。

### パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "MastraLanguageModel",
description: "ツールの適切性を評価するために使用する LLM モデル",
required: true,
},
{
name: "availableTools",
type: "Array<{name: string, description: string}>",
description: "文脈理解のための説明付きで利用可能なツール一覧",
required: true,
},
]}
/>

### 機能 \{#features\}

LLMベースのスコアラーは次の機能を提供します:

* **意味的評価**: 文脈とユーザー意図を理解する
* **妥当性評価**: 「helpful」と「appropriate」の観点でツールを区別する
* **確認要求の扱い**: エージェントが適切に確認（明確化）を求める場面を認識する
* **不足ツールの検知**: 本来呼び出すべきだったツールを特定する
* **推論生成**: スコアリング判断の根拠を提示する

### 評価プロセス \{#evaluation-process\}

1. **ツール呼び出しの抽出**: エージェント出力で言及されたツールを特定する
2. **適切性の分析**: 各ツールがユーザーの要求に適合しているか評価する
3. **スコアの生成**: 適切なツール呼び出し数と総呼び出し数に基づいてスコアを算出する
4. **理由の生成**: 人間が読みやすい説明を提示する

### 例 \{#examples\}

```typescript
import { createToolCallAccuracyScorerLLM } from '@mastra/evals/scorers/llm';
import { openai } from '@ai-sdk/openai';

const llmScorer = createToolCallAccuracyScorerLLM({
  model: openai('gpt-4o-mini'),
  availableTools: [
    {
      name: 'weather-tool',
      description: '任意の場所の現在の天気を取得する',
    },
    {
      name: 'search-tool',
      description: 'ウェブ上の情報を検索する',
    },
    {
      name: 'calendar-tool',
      description: 'カレンダーの予定やスケジュールを確認する',
    },
  ],
});

const result = await llmScorer.run(agentRun);
console.log(result.score); // 0.0～1.0
console.log(result.reason); // スコアの説明
```

## スコアリング手法の選び方 \{#choosing-between-scorers\}

### 次のような場合はコードベースのスコアラーを使用してください: \{#use-the-code-based-scorer-when\}

* **決定的で再現可能**な結果が必要なとき
* **ツールの完全一致**をテストしたいとき
* **特定のツール実行順序**を検証する必要があるとき
* 速度とコストを優先したいとき（LLM 呼び出しなし）
* 自動テストを実行しているとき

### 次のような場合に LLM ベースのスコアラーを使用します: \{#use-the-llm-based-scorer-when\}

* 適切さの**意味的理解**が必要なとき
* ツール選択が**文脈や意図**に左右される場合
* 確認や説明の要求といった**例外的なケース**を扱いたいとき
* スコアリング判断の**理由説明**が必要なとき
* **本番環境でのエージェント挙動**を評価している場合

## スコアの詳細 \{#scoring-details\}

### コードベースのスコアリング \{#code-based-scoring\}

* **二値スコア**: 常に 0 か 1 を返す
* **決定的**: 同じ入力なら常に同じ出力になる
* **高速**: 外部 API 呼び出しなし

### LLMベースのスコアリング \{#llm-based-scoring\}

* **小数スコア**: 0.0〜1.0の範囲で返す
* **コンテキスト対応**: ユーザーの意図や文脈上の妥当性を考慮
* **説明可能**: スコアの根拠を提示

## 活用例 \{#use-cases\}

### コードベースのスコアラーのユースケース \{#code-based-scorer-use-cases\}

* **ユニットテスト**: 特定のツール選択の挙動を検証
* **リグレッションテスト**: ツール選択が変わらないことを確認
* **ワークフロー検証**: 複数ステップの処理でのツールの実行順を確認
* **CI/CD パイプライン**: 高速かつ決定的な検証

### LLMベースのスコアラーの活用例 \{#llm-based-scorer-use-cases\}

* **品質保証**: 本番環境のエージェント挙動を評価
* **A/Bテスト**: 複数のエージェント実装を比較
* **ユーザー意図との整合**: ツールがユーザーのニーズに適合しているかを確認
* **エッジケース対応**: 確認やエラー発生時のシナリオを評価

## 関連項目 \{#related\}

* [解答の関連性スコアラー](./answer-relevancy)
* [網羅性スコアラー](./completeness)
* [忠実性スコアラー](./faithfulness)
* [カスタムスコアラー](/docs/scorers/custom-scorers)