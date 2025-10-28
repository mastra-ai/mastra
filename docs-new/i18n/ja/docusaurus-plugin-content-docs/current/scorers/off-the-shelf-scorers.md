---
title: "市販スコアラー"
description: "Mastra のすぐに使えるスコアラーで、AI 出力を品質・安全性・パフォーマンスの観点から評価するための概要。"
sidebar_position: 2
---

# 組み込みスコアラー \{#built-in-scorers\}

Mastra は、AI の出力を評価するための包括的な組み込みスコアラーを提供します。これらのスコアラーは一般的な評価シナリオ向けに最適化されており、エージェントやワークフローでそのまま利用できます。

## 利用可能なスコアリング手法 \{#available-scorers\}

### 正確性と信頼性 \{#accuracy-and-reliability\}

これらのスコアラーは、エージェントの回答がどれだけ正確で、真実性があり、網羅的かを評価します:

* [`answer-relevancy`](/docs/reference/scorers/answer-relevancy): 応答が入力クエリにどれだけ適切に対応しているかを評価します（`0-1`、高いほど良い）
* [`answer-similarity`](/docs/reference/scorers/answer-similarity): セマンティック分析を用い、CI/CD テストのためにエージェントの出力を正解と比較します（`0-1`、高いほど良い）
* [`faithfulness`](/docs/reference/scorers/faithfulness): 応答が提供されたコンテキストをどれだけ正確に反映しているかを測定します（`0-1`、高いほど良い）
* [`hallucination`](/docs/reference/scorers/hallucination): 事実の矛盾や根拠のない主張を検出します（`0-1`、低いほど良い）
* [`completeness`](/docs/reference/scorers/completeness): 応答に必要な情報がすべて含まれているかを確認します（`0-1`、高いほど良い）
* [`content-similarity`](/docs/reference/scorers/content-similarity): 文字レベルのマッチングでテキストの類似度を測定します（`0-1`、高いほど良い）
* [`textual-difference`](/docs/reference/scorers/textual-difference): 文字列間のテキスト差分を測定します（`0-1`、値が高いほど類似度が高い）
* [`tool-call-accuracy`](/docs/reference/scorers/tool-call-accuracy): LLM が利用可能な選択肢から正しいツールを選べているかを評価します（`0-1`、高いほど良い）
* [`prompt-alignment`](/docs/reference/scorers/prompt-alignment): エージェントの応答がユーザーのプロンプトの意図、要件、網羅性、形式にどれだけ整合しているかを測定します（`0-1`、高いほど良い）

### コンテキスト品質 \{#context-quality\}

以下のスコアラーは、応答生成に用いられるコンテキストの品質と関連性を評価します：

* [`context-precision`](/docs/reference/scorers/context-precision): Mean Average Precision に基づき、コンテキストの関連性と順位付けを評価し、関連コンテキストを早い段階で上位に配置できているほど高く評価します（`0-1`、高いほど良い）
* [`context-relevance`](/docs/reference/scorers/context-relevance): 細かな関連度レベル、使用状況のトラッキング、欠落コンテキストの検出を含めて、コンテキストの有用性を測定します（`0-1`、高いほど良い）

> tip コンテキストスコアラーの選択

* コンテキストの順序が重要で、標準的なIRメトリクスが必要な場合は **Context Precision** を使用（RAGのランキング評価に最適）
* より詳細な関連性評価が必要で、コンテキストの使用状況を追跡しギャップを特定したい場合は **Context Relevance** を使用

両方のコンテキストスコアラーは以下に対応しています：

* **静的コンテキスト**：あらかじめ定義されたコンテキスト配列
* **動的コンテキスト抽出**：カスタム関数を使い、実行データからコンテキストを抽出（RAGシステム、ベクターデータベースなどに最適）

### 出力品質 \{#output-quality\}

以下のスコアラーは、形式、文体、および安全性要件への準拠を評価します:

* [`tone-consistency`](/docs/reference/scorers/tone-consistency): フォーマリティ、複雑さ、文体の一貫性を測定します（`0-1`、高いほど良い）
* [`toxicity`](/docs/reference/scorers/toxicity): 有害または不適切な内容を検出します（`0-1`、低いほど良い）
* [`bias`](/docs/reference/scorers/bias): 出力に潜在する偏りを検出します（`0-1`、低いほど良い）
* [`keyword-coverage`](/docs/reference/scorers/keyword-coverage): 専門用語の網羅・使用状況を評価します（`0-1`、高いほど良い）