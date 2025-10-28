---
title: "リファレンス: 完全性"
description: Mastra の Completeness Scorer に関するドキュメント。入力に含まれる重要な要素を、LLM の出力がどの程度適切にカバーしているかを評価します。
---

# 完全性スコアラー \{#completeness-scorer\}

`createCompletenessScorer()` 関数は、入力に含まれる主要要素をどれだけカバーしているかという観点から、LLM の出力を評価します。名詞・動詞・トピック・用語を分析して網羅状況を判定し、詳細な完全性スコアを提示します。

使用例は [Completeness Examples](/docs/examples/scorers/completeness) を参照してください。

## パラメーター \{#parameters\}

`createCompletenessScorer()` 関数はオプションを受け取りません。

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
name: "preprocessStepResult",
type: "object",
description: "抽出要素とカバレッジの詳細を含むオブジェクト: { inputElements: string[], outputElements: string[], missingElements: string[], elementCounts: { input: number, output: number } }",
},
{
name: "score",
type: "number",
description: "出力でカバーされた入力要素の割合を表す完全性スコア（0〜1）。",
},
]}
/>

## 要素抽出の詳細 \{#element-extraction-details\}

スコアラーは次の種類の要素を抽出・分析します:

* 名詞: 主要な対象、概念、エンティティ
* 動詞: 行為や状態（不定形に正規化）
* トピック: 主題やテーマ
* 用語: 重要な単語

抽出プロセスには以下が含まれます:

* テキストの正規化（ダイアクリティカルマークの除去、小文字化）
* camelCase の単語の分割
* 単語境界の処理
* 短い単語（3文字以下）の特別な扱い
* 要素の重複排除

## 採点の詳細 \{#scoring-details\}

採点者は、言語要素の網羅状況を分析することで、完全性を評価します。

### スコアリング手順 \{#scoring-process\}

1. 主要要素を抽出:
   * 名詞と固有表現
   * 作用動詞
   * トピック固有の用語
   * 正規化された語形
2. 入力要素のカバレッジを算出:
   * 短い用語（≤3文字）は完全一致
   * 長い用語は大幅な重なり（&gt;60%）

最終スコア: `(covered_elements / total_input_elements) * scale`

### スコアの解釈 \{#score-interpretation\}

（0からのスケール、デフォルトは0～1）

* 1.0: 完全に網羅 - すべての入力要素を含む
* 0.7～0.9: 高い網羅性 - 主要な要素のほとんどを含む
* 0.4～0.6: 部分的な網羅性 - 主要な要素の一部を含む
* 0.1～0.3: 低い網羅性 - 主要な要素の大半が欠落
* 0.0: 網羅なし - 出力に入力要素がまったく含まれない

## 関連項目 \{#related\}

* [回答関連性スコアラー](./answer-relevancy)
* [コンテンツ類似度スコアラー](./content-similarity)
* [テキスト差分スコアラー](./textual-difference)
* [キーワード網羅度スコアラー](./keyword-coverage)