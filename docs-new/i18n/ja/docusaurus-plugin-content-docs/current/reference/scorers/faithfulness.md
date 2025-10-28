---
title: "リファレンス：Faithfulness"
description: Mastra の Faithfulness Scorer に関するドキュメント。提供されたコンテキストに照らして、LLM の出力がどれだけ事実に即しているかを評価します。
---

# Faithfulness Scorer \{#faithfulness-scorer\}

`createFaithfulnessScorer()` 関数は、提供されたコンテキストと照らして LLM の出力がどれほど事実に忠実かを評価します。出力から主張を抽出し、それらをコンテキストに基づいて検証するため、RAG パイプラインの応答の信頼性を測定するうえで不可欠です。

使用例は [Faithfulness Examples](/docs/examples/scorers/faithfulness) を参照してください。

## パラメーター \{#parameters\}

`createFaithfulnessScorer()` 関数は、次のプロパティを持つ単一のオプションオブジェクトを受け取ります。

<PropertiesTable
  content={[
{
name: "model",
type: "LanguageModel",
required: true,
description: "忠実性評価に使用するモデルの設定。",
},
{
name: "context",
type: "string[]",
required: true,
description: "出力の主張を検証するための参照用コンテキストチャンクの配列。",
},
{
name: "scale",
type: "number",
required: false,
defaultValue: "1",
description: "スコアの最大値。最終スコアはこのスケールに正規化されます。",
},
]}
/>

この関数は MastraScorer クラスのインスタンスを返します。`.run()` メソッドは他のスコアラーと同じ入力を受け付けます（[MastraScorer リファレンス](./mastra-scorer)を参照）。ただし、戻り値には以下に記載の LLM 固有のフィールドが含まれます。

## .run() の戻り値 \{#run-returns\}

<PropertiesTable
  content={[
{
name: "runId",
type: "string",
description: "実行 ID（任意）。",
},
{
name: "preprocessStepResult",
type: "string[]",
description: "出力から抽出された主張の配列。",
},
{
name: "preprocessPrompt",
type: "string",
description: "preprocess ステップで LLM に送信されたプロンプト（任意）。",
},
{
name: "analyzeStepResult",
type: "object",
description: "判定を含むオブジェクト: { verdicts: Array<{ verdict: 'yes' | 'no' | 'unsure', reason: string }> }",
},
{
name: "analyzePrompt",
type: "string",
description: "analyze ステップで LLM に送信されたプロンプト（任意）。",
},
{
name: "score",
type: "number",
description: "0 から設定スケールまでのスコアで、コンテキストにより裏付けられた主張の割合を表します。",
},
{
name: "reason",
type: "string",
description: "スコアの詳細な説明。どの主張が支持されたか、矛盾したか、不明と判断されたかを含みます。",
},
{
name: "generateReasonPrompt",
type: "string",
description: "generateReason ステップで LLM に送信されたプロンプト（任意）。",
},
]}
/>

## 採点の詳細 \{#scoring-details\}

採点者は、提供されたコンテキストに照らして主張を検証することで、忠実性を評価します。

### 採点プロセス \{#scoring-process\}

1. 主張とコンテキストを分析:
   * すべての主張（事実・推測）を抽出
   * 各主張をコンテキストと照合して検証
   * 次の3つの判定のいずれかを付与:
     * &quot;yes&quot; - コンテキストにより主張が支持されている
     * &quot;no&quot; - コンテキストと主張が矛盾している
     * &quot;unsure&quot; - 主張は検証不能
2. 忠実度スコアを算出:
   * 支持された主張数を数える
   * 総主張数で割る
   * 設定した範囲にスケーリングする

最終スコア: `(supported_claims / total_claims) * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から、既定では0〜1）

* 1.0: すべての主張が文脈によって裏付けられている
* 0.7-0.9: ほとんどの主張が裏付けられており、検証不能なものは少数
* 0.4-0.6: 裏付けは一部にとどまり、矛盾も見られる
* 0.1-0.3: 裏付けが限られており、矛盾が多い
* 0.0: 裏付けられた主張はない

## 関連項目 \{#related\}

* [解答関連性スコアラー](./answer-relevancy)
* [幻覚スコアラー](./hallucination)