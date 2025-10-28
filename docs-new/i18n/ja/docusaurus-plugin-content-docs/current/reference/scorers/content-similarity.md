---
title: "リファレンス：コンテンツ類似度"
description: Mastra の Content Similarity Scorer に関するドキュメント。文字列間のテキストの類似度を測定し、マッチングスコアを提供します。
---

# コンテンツ類似度スコアラー \{#content-similarity-scorer\}

`createContentSimilarityScorer()` 関数は、2つの文字列のテキスト類似度を測定し、どの程度一致しているかを示すスコアを返します。大文字・小文字の区別や空白の扱いを設定できるオプションをサポートしています。

使用例は [Content Similarity Examples](/docs/examples/scorers/content-similarity) を参照してください。

## パラメータ \{#parameters\}

`createContentSimilarityScorer()` 関数は、次のプロパティを持つ単一のオプションオブジェクトを受け取ります。

<PropertiesTable
  content={[
{
name: "ignoreCase",
type: "boolean",
required: false,
defaultValue: "true",
description: "文字列の比較時に大文字・小文字の違いを無視するかどうか。",
},
{
name: "ignoreWhitespace",
type: "boolean",
required: false,
defaultValue: "true",
description: "文字列の比較時に空白を正規化するかどうか。",
},
]}
/>

この関数は MastraScorer クラスのインスタンスを返します。`.run()` メソッドとその入出力の詳細については、[MastraScorer リファレンス](./mastra-scorer)を参照してください。

## .run() の戻り値 \{#run-returns\}

<PropertiesTable
  content={[
{
name: "runId",
type: "string",
description: "実行のID（任意）。",
},
{
name: "preprocessStepResult",
type: "object",
description: "処理後の入力と出力を含むオブジェクト: { processedInput: string, processedOutput: string }",
},
{
name: "analyzeStepResult",
type: "object",
description: "類似度を含むオブジェクト: { similarity: number }",
},
{
name: "score",
type: "number",
description: "類似度スコア（0〜1）。1は完全な類似を示します。",
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

評価器は、文字単位のマッチングと、設定可能なテキスト正規化を用いてテキストの類似度を評価します。

### スコアリングプロセス \{#scoring-process\}

1. テキストを正規化:
   * 大文字・小文字を統一（ignoreCase: true の場合）
   * 空白を正規化（ignoreWhitespace: true の場合）
2. 正規化後の文字列を文字列類似度アルゴリズムで比較:
   * 文字列の並びを分析
   * 単語境界を整合
   * 相対的な位置を考慮
   * 長さの差を考慮

最終スコア: `similarity_value * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から、既定は0～1）

* 1.0: 完全一致 - テキストが同一
* 0.7～0.9: 高い類似度 - ほとんどの内容が一致
* 0.4～0.6: 中程度の類似度 - 一部が一致
* 0.1～0.3: 低い類似度 - 一致するパターンが少ない
* 0.0: 類似性なし - まったく異なるテキスト

## 関連項目 \{#related\}

* [完全性スコアラー](./completeness)
* [テキスト差分スコアラー](./textual-difference)
* [回答関連性スコアラー](./answer-relevancy)
* [キーワード網羅度スコアラー](./keyword-coverage)