---
title: "リファレンス: Hallucination"
description: Mastra の Hallucination Scorer のドキュメントです。提供されたコンテキストとの矛盾を検出し、LLM の出力が事実に即しているかを評価します。
---

# 幻覚スコアラー \{#hallucination-scorer\}

`createHallucinationScorer()` 関数は、提供されたコンテキストとモデルの出力を比較し、LLM が事実に即した情報を生成しているかを評価します。このスコアラーは、コンテキストと出力の間の明確な矛盾を検出することで、ハルシネーションの度合いを測定します。

使用例は [Hallucination Examples](/docs/examples/scorers/hallucination) を参照してください。

## パラメーター \{#parameters\}

`createHallucinationScorer()` 関数は、次のプロパティを持つ単一のオプションオブジェクトを受け取ります:

<PropertiesTable
  content={[
{
name: "model",
type: "LanguageModel",
required: true,
description: "ハルシネーションの評価に使用するモデルの設定。",
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

この関数は MastraScorer クラスのインスタンスを返します。`.run()` メソッドは他のスコアラーと同じ入力を受け取ります（[MastraScorer リファレンス](./mastra-scorer)を参照）。ただし、戻り値には以下に記載の LLM 固有のフィールドが含まれます。

## .run() の戻り値 \{#run-returns\}

<PropertiesTable
  content={[
{
name: "runId",
type: "string",
description: "実行ID（任意）。",
},
{
name: "preprocessStepResult",
type: "object",
description: "抽出された主張を含むオブジェクト: { claims: string[] }",
},
{
name: "preprocessPrompt",
type: "string",
description: "前処理ステップで LLM に送信したプロンプト（任意）。",
},
{
name: "analyzeStepResult",
type: "object",
description: "判定結果を含むオブジェクト: { verdicts: Array<{ statement: string, verdict: 'yes' | 'no', reason: string }> }",
},
{
name: "analyzePrompt",
type: "string",
description: "分析ステップで LLM に送信したプロンプト（任意）。",
},
{
name: "score",
type: "number",
description: "ハルシネーション・スコア（0 からの尺度、既定は 0–1）。",
},
{
name: "reason",
type: "string",
description: "スコアおよび特定された矛盾の詳細な説明。",
},
{
name: "generateReasonPrompt",
type: "string",
description: "generateReason ステップで LLM に送信したプロンプト（任意）。",
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

スコアリング担当者は、矛盾の検出と根拠のない主張の分析によってハルシネーションを評価します。

### スコアリング手順 \{#scoring-process\}

1. 事実関係を分析:
   * コンテキストから記述（ステートメント）を抽出
   * 数値や日付を特定
   * 記述間の関係をマッピング
2. 出力のハルシネーションを検出・評価:
   * コンテキスト中の記述と照合
   * 直接の矛盾はハルシネーションとしてマーク
   * 根拠のない主張をハルシネーションとして特定
   * 数値の正確性を評価
   * 近似の許容範囲や文脈を考慮
3. ハルシネーションスコアを算出:
   * ハルシネーション（矛盾と根拠のない主張）の件数をカウント
   * 総記述数で割る
   * 設定した範囲にスケーリング

最終スコア: `(hallucinated_statements / total_statements) * scale`

### 重要な考慮事項 \{#important-considerations\}

* コンテキストに存在しない主張はハルシネーションとして扱う
* 主観的な主張は、明示的な裏付けがない限りハルシネーションとみなす
* コンテキスト内の事実に関する推測的な表現（&quot;might&quot;、&quot;possibly&quot;）は許容される
* コンテキスト外の事実に関する推測的な表現はハルシネーションとして扱う
* 空の出力はハルシネーション数がゼロとなる
* 数値評価では次を考慮する：
  * スケールに見合った精度
  * 文脈に基づく近似
  * 明示的な精度指標

### スコアの解釈 \{#score-interpretation\}

（0からのスケール、デフォルトは0～1）

* 1.0: 完全なハルシネーション - すべてのコンテキスト記述に反する
* 0.75: 高度なハルシネーション - コンテキスト記述の75%に反する
* 0.5: 中程度のハルシネーション - コンテキスト記述の半分に反する
* 0.25: 低度のハルシネーション - コンテキスト記述の25%に反する
* 0.0: ハルシネーションなし - 出力がすべてのコンテキスト記述と一致する

**注:** スコアはハルシネーションの程度を表します。スコアが低いほど、与えられたコンテキストとの事実整合性が高いことを示します

## 関連項目 \{#related\}

* [忠実度スコアラー](./faithfulness)
* [回答関連性スコアラー](./answer-relevancy)