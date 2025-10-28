---
title: "リファレンス: トーンの整合性"
description: Mastra の Tone Consistency Scorer のドキュメント。テキストの感情的なトーンとセンチメントの整合性を評価します。
---

# トーン一貫性スコアラー \{#tone-consistency-scorer\}

`createToneScorer()` 関数は、テキストの感情的なトーンと感情表現の一貫性を評価します。入力と出力のペア間でトーンを比較するモードと、単一のテキスト内でトーンの安定性を分析するモードの2つの動作モードがあります。

使用例については、[トーン一貫性の例](/docs/examples/scorers/tone-consistency)を参照してください。

## パラメーター \{#parameters\}

`createToneScorer()` 関数にはオプションはありません。

この関数は MastraScorer クラスのインスタンスを返します。`.run()` メソッドとその入出力の詳細は、[MastraScorer リファレンス](./mastra-scorer)を参照してください。

## .run() の戻り値 \{#run-returns\}

<PropertiesTable
  content={[
{
name: "runId",
type: "string",
description: "実行のID（オプション）。",
},
{
name: "analyzeStepResult",
type: "object",
description: "トーン指標を含むオブジェクト: { responseSentiment: number, referenceSentiment: number, difference: number }（比較モード）または { avgSentiment: number, sentimentVariance: number }（安定性モード）",
},
{
name: "score",
type: "number",
description: "トーンの一貫性／安定性スコア（0〜1）。",
},
]}
/>

## スコア詳細 \{#scoring-details\}

評価者は、トーンパターンの分析とモード別のスコアリングによって、感情の一貫性を評価します。

### 採点プロセス \{#scoring-process\}

1. トーンパターンを分析:
   * 感情的特徴を抽出
   * 感情スコアを算出
   * トーンの変動を測定
2. モード別スコアを算出:
   **トーンの一貫性**（入力と出力）:
   * テキスト間の感情を比較
   * 感情差を算出
   * スコア = 1 - (sentiment&#95;difference / max&#95;difference)
     **トーンの安定性**（単一入力）:
   * 文間の感情を分析
   * 感情の分散を算出
   * スコア = 1 - (sentiment&#95;variance / max&#95;variance)

最終スコア: `mode_specific_score * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から。デフォルトは0〜1）

* 1.0: トーンの一貫性／安定性が完全
* 0.7–0.9: 軽微な変動はあるが高い一貫性
* 0.4–0.6: 目立つ変化を伴う中程度の一貫性
* 0.1–0.3: 大きなトーン変化がある低い一貫性
* 0.0: 一貫性なし — まったく別のトーン

## 関連情報 \{#related\}

* [コンテンツ類似度スコアラー](./content-similarity)
* [毒性スコアラー](./toxicity)