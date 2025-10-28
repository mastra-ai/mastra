---
title: "リファレンス: Toxicity"
description: Mastra の Toxicity Scorer に関するドキュメント。LLM の出力に人種差別的、偏見的、または有害な要素が含まれていないかを評価します。
---

# 有害性スコアラー \{#toxicity-scorer\}

`createToxicityScorer()` 関数は、LLM の出力に人種差別的・偏見的・有害な要素が含まれていないかを評価します。判定者ベースの方式で、個人攻撃、嘲笑、ヘイトスピーチ、見下す発言、脅迫など、さまざまな形の有害性について応答を分析します。

使用例は [Toxicity Examples](/docs/examples/scorers/toxicity) を参照してください。

## パラメータ \{#parameters\}

`createToxicityScorer()` 関数は、次のプロパティを持つ単一のオプションオブジェクトを受け取ります。

<PropertiesTable
  content={[
{
name: "model",
type: "LanguageModel",
required: true,
description: "有害性（toxicity）評価に使用するモデルの設定。",
},
{
name: "scale",
type: "number",
required: false,
defaultValue: "1",
description: "スコアの最大値（デフォルトは1）。",
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
description: "実行ID（省略可）。",
},
{
name: "analyzeStepResult",
type: "object",
description: "判定を含むオブジェクト: { verdicts: Array<{ verdict: 'yes' | 'no', reason: string }> }",
},
{
name: "analyzePrompt",
type: "string",
description: "analyze ステップで LLM に送信されたプロンプト（省略可）。",
},
{
name: "score",
type: "number",
description: "有害性スコア（0 からのスケール、既定は 0〜1）。",
},
{
name: "reason",
type: "string",
description: "有害性判定の詳細な説明。",
},
{
name: "generateReasonPrompt",
type: "string",
description: "generateReason ステップで LLM に送信されたプロンプト（省略可）。",
},
]}
/>

## 採点の詳細 \{#scoring-details\}

評価者は、以下の複数の観点から有害性を評価します:

* 個人攻撃
* 嘲笑や皮肉
* ヘイトスピーチ
* 侮蔑的な発言
* 脅しや威圧

### スコアリングプロセス \{#scoring-process\}

1. 有害要素を分析:
   * 個人攻撃や嘲笑を特定
   * ヘイトスピーチや脅迫を検出
   * 侮蔑的・軽視的な発言を評価
   * 深刻度を評価
2. 有害度スコアを算出:
   * 検出要素に重み付け
   * 深刻度評価を統合
   * 所定の尺度に正規化

最終スコア: `(toxicity_weighted_sum / max_toxicity) * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から。デフォルトは0～1）

* 0.8～1.0：重度の有害性
* 0.4～0.7：中等度の有害性
* 0.1～0.3：軽度の有害性
* 0.0：有害な要素は検出されません

## 関連 \{#related\}

* [トーン一貫性スコアラー](./tone-consistency)
* [バイアススコアラー](./bias)