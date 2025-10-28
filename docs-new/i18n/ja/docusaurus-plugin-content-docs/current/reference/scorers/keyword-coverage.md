---
title: "リファレンス：キーワードカバレッジ"
description: Mastra のキーワードカバレッジ・スコアラーに関するドキュメント。入力の重要なキーワードが LLM の出力でどの程度カバーされているかを評価します。
---

# キーワード網羅度スコアラー \{#keyword-coverage-scorer\}

`createKeywordCoverageScorer()` 関数は、入力に含まれる重要なキーワードが LLM の出力でどの程度カバーされているかを評価します。一般的な語やストップワードを除外し、キーワードの出現と一致を分析します。

使用例は [Keyword Coverage Examples](/docs/examples/scorers/keyword-coverage) を参照してください。

## パラメーター \{#parameters\}

`createKeywordCoverageScorer()` 関数にはオプションはありません。

この関数は MastraScorer クラスのインスタンスを返します。`.run()` メソッドとその入出力については、[MastraScorer リファレンス](./mastra-scorer)を参照してください。

## .run() の戻り値 \{#run-returns\}

<PropertiesTable
  content={[
{
name: "runId",
type: "string",
description: "実行の ID（任意）。",
},
{
name: "preprocessStepResult",
type: "object",
description: "抽出されたキーワードを含むオブジェクト: { referenceKeywords: Set<string>, responseKeywords: Set<string> }",
},
{
name: "analyzeStepResult",
type: "object",
description: "キーワードのカバレッジを示すオブジェクト: { totalKeywords: number, matchedKeywords: number }",
},
{
name: "score",
type: "number",
description: "一致したキーワードの比率を表すカバレッジスコア（0〜1）。",
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

スコアラーは、次の機能でキーワードを照合し、キーワードの網羅性を評価します:

* 一般語およびストップワードのフィルタリング（例: “the”、“a”、“and”）
* 大文字・小文字を区別しないマッチング
* 語形のゆれへの対応
* 技術用語や複合語に対する特別な処理

### スコアリングの流れ \{#scoring-process\}

1. 入力と出力のキーワードを処理:
   * 一般的な語やストップワードを除外
   * 大文字・小文字や語形を正規化
   * 固有の用語や複合語に対応
2. キーワードのカバレッジを算出:
   * テキスト間でキーワードを照合
   * 一致した件数をカウント
   * カバレッジ比を計算

最終スコア: `(matched_keywords / total_keywords) * scale`

### スコアの解釈 \{#score-interpretation\}

（スケールは0から、デフォルトは0〜1）

* 1.0: キーワードの網羅が完全
* 0.7-0.9: ほとんどのキーワードを含む良好な網羅性
* 0.4-0.6: 一部のキーワードが欠けている中程度の網羅性
* 0.1-0.3: 多くのキーワードが欠けている不十分な網羅性
* 0.0: キーワード一致なし

## 特別なケース \{#special-cases\}

スコアラーは次の特別なケースを処理します:

* 入力/出力が空: 両方空なら 1.0、どちらか一方のみ空なら 0.0 を返す
* 単語が1つ: 単一のキーワードとして扱う
* 技術用語: 複合的な技術用語を保持（例: &quot;React.js&quot;、&quot;machine learning&quot;）
* 大文字小文字の違い: &quot;JavaScript&quot; は &quot;javascript&quot; と一致する
* よく使われる語: 意味のあるキーワードに焦点を当てるため、スコアリングでは無視

## 関連項目 \{#related\}

* [完全性スコアラー](./completeness)
* [内容類似度スコアラー](./content-similarity)
* [回答関連度スコアラー](./answer-relevancy)
* [テキスト差分スコアラー](./textual-difference)