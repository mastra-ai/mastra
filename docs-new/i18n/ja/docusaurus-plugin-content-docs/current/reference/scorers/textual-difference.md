---
title: "リファレンス：Textual Difference"
description: Mastra の Textual Difference Scorer に関するドキュメント。シーケンスマッチングを用いて、文字列間のテキスト差を測定します。
---

# テキスト差分スコアラー \{#textual-difference-scorer\}

`createTextualDifferenceScorer()` 関数は、シーケンスマッチングを用いて2つの文字列間のテキスト差分を測定します。あるテキストを別のテキストへ変換するのに必要な操作数を含む、変更点に関する詳細な情報を提供します。

使用例は [テキスト差分のサンプル](/docs/examples/scorers/textual-difference) を参照してください。

## パラメータ \{#parameters\}

`createTextualDifferenceScorer()` 関数にはオプションはありません。

この関数は MastraScorer クラスのインスタンスを返します。`.run()` メソッドとその入出力の詳細は [MastraScorer リファレンス](./mastra-scorer) を参照してください。

## .run() の戻り値 \{#run-returns\}

<PropertiesTable
  content={[
{
name: "runId",
type: "string",
description: "実行のID（任意）。",
},
{
name: "analyzeStepResult",
type: "object",
description: "差分指標を含むオブジェクト: { confidence: number, changes: number, lengthDiff: number }",
},
{
name: "score",
type: "number",
description: "類似度（0〜1）。1はテキストが完全に一致することを示します。",
},
]}
/>

## スコア詳細 \{#scoring-details\}

スコアラーは複数の指標を算出します:

* **類似度比**: テキスト間のシーケンスマッチングに基づく値（0〜1）
* **変更数**: 不一致を解消するために必要な編集操作の回数
* **長さの差**: テキスト長の正規化された差
* **信頼度**: 長さの差に反比例する値

### スコアリング処理 \{#scoring-process\}

1. テキスト差分を解析:
   * 入力と出力のシーケンスを照合
   * 必要な変更操作の回数をカウント
   * 長さの差を測定
2. 指標を算出:
   * 類似度比を計算
   * 信頼度スコアを算出
   * 重み付きスコアに統合

最終スコア: `(similarity_ratio * confidence) * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から、既定は0〜1）

* 1.0: テキストが同一—差異なし
* 0.7〜0.9: 軽微な差異—わずかな修正が必要
* 0.4〜0.6: 中程度の差異—大幅な修正が必要
* 0.1〜0.3: 大きな差異—大規模な修正が必要
* 0.0: まったく異なるテキスト

## 関連項目 \{#related\}

* [コンテンツ類似度スコアラー](./content-similarity)
* [完全性スコアラー](./completeness)
* [キーワード網羅度スコアラー](./keyword-coverage)