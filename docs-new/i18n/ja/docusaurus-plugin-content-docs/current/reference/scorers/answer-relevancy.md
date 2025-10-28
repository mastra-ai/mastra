---
title: "リファレンス: Answer Relevancy"
description: Mastra の Answer Relevancy Scorer に関するドキュメント。LLM の出力が入力クエリにどの程度適合しているか（関連しているか）を評価します。
---

# Answer Relevancy Scorer \{#answer-relevancy-scorer\}

`createAnswerRelevancyScorer()` 関数は、以下のプロパティを持つ単一のオプションオブジェクトを受け取ります。

使用例については、[Answer Relevancy Examples](/docs/examples/scorers/answer-relevancy) をご覧ください。

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "LanguageModel",
required: true,
description: "関連性の評価に使用するモデルの設定。",
},
{
name: "uncertaintyWeight",
type: "number",
required: false,
defaultValue: "0.3",
description: "スコアリングにおいて「不明」判定に与える重み（0〜1）。",
},
{
name: "scale",
type: "number",
required: false,
defaultValue: "1",
description: "スコアの最大値。",
},
]}
/>

この関数は MastraScorer クラスのインスタンスを返します。`.run()` メソッドは他のスコアラーと同じ入力を受け取ります（[MastraScorer リファレンス](./mastra-scorer)を参照）が、戻り値には以下に記載の LLM 固有のフィールドが含まれます。

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
description: "関連度スコア（0からのスケール、既定は0〜1）。",
},
{
name: "preprocessPrompt",
type: "string",
description: "前処理ステップでLLMに送信されたプロンプト（省略可）。",
},
{
name: "preprocessStepResult",
type: "object",
description: "抽出された文を含むオブジェクト: { statements: string[] }",
},
{
name: "analyzePrompt",
type: "string",
description: "分析ステップでLLMに送信されたプロンプト（省略可）。",
},
{
name: "analyzeStepResult",
type: "object",
description: "結果を含むオブジェクト: { results: Array<{ result: 'yes' | 'unsure' | 'no', reason: string }> }",
},
{
name: "generateReasonPrompt",
type: "string",
description: "理由生成ステップでLLMに送信されたプロンプト（省略可）。",
},
{
name: "reason",
type: "string",
description: "スコアの説明。",
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

採点者は、事実の正確性ではなく、クエリと回答の整合性に基づいて関連性を評価し、その際に網羅性や詳細度も考慮します。

### スコアリング手順 \{#scoring-process\}

1. **文の前処理:**
   * 文脈を保ちつつ、出力を意味のある文に分割します。
2. **関連性の評価:**
   * 各文を次のいずれかとして判定します:
     * &quot;yes&quot;: 直接一致には満額の重み
     * &quot;unsure&quot;: 概ね一致には一部の重み（既定値: 0.3）
     * &quot;no&quot;: 無関係な内容には重みゼロ
3. **スコア計算:**
   * `((direct + uncertainty * partial) / total_statements) * scale`

### スコアの解釈 \{#score-interpretation\}

* 1.0: 完全に適合 — 完全かつ正確
* 0.7-0.9: 高い適合度 — わずかな欠落や不正確さ
* 0.4-0.6: 中程度の適合度 — 目立つ欠落
* 0.1-0.3: 低い適合度 — 重大な問題
* 0.0: 非適合 — 誤りまたは的外れ

## 関連項目 \{#related\}

* [Faithfulness Scorer](./faithfulness)