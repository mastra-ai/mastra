---
title: "テキスト評価"
description: "Mastra がテキスト品質を評価するために LLM-as-judge 手法をどのように活用しているかを理解する。"
sidebar_position: 2
---

# テキスト評価 \{#textual-evals\}

:::info 新しい Scorers API

エラー分析のためのメタデータをより豊富に保存し、データ構造の評価にも柔軟に対応できる、より扱いやすい新しい評価 API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

テキスト評価は、LLM を審査員として用いる手法でエージェントの出力を評価します。このアプローチは、ティーチングアシスタントがルーブリックを使って課題を採点するのに似ており、言語モデルを活用してテキスト品質のさまざまな側面を評価します。

各評価は特定の品質面にフォーカスし、0～1 のスコアを返して、非決定的な AI 出力に対する定量的な指標を提供します。

Mastra はエージェントの出力を評価するための複数の評価指標を提供します。Mastra はこれらの指標に限らず、[独自の評価を定義](/docs/scorers/evals/custom-eval)することもできます。

## なぜ Textual Evals を使うのか？ \{#why-use-textual-evals\}

Textual Evals は、エージェントが次の点を確実に満たすのに役立ちます:

* 正確で信頼できる回答を出す
* コンテキストを効果的に活用する
* 出力要件に従う
* 時間が経っても一貫した品質を維持する

## 利用可能なメトリクス \{#available-metrics\}

### 正確性と信頼性 \{#accuracy-and-reliability\}

これらの指標は、エージェントの回答がどれほど正確で、事実に即しており、網羅的であるかを評価します:

* [`hallucination`](/docs/reference/evals/hallucination): 提供されたコンテキストに存在しない事実や主張を検出
* [`faithfulness`](/docs/reference/evals/faithfulness): 応答が提供されたコンテキストをどれだけ正確に反映しているかを測定
* [`content-similarity`](/docs/reference/evals/content-similarity): 異なる言い回し間での情報の一貫性を評価
* [`completeness`](/docs/reference/evals/completeness): 応答に必要な情報がすべて含まれているかを確認
* [`answer-relevancy`](/docs/reference/evals/answer-relevancy): 応答が元のクエリにどれほど適切に答えているかを評価
* [`textual-difference`](/docs/reference/evals/textual-difference): 文字列間のテキスト差分を測定

### コンテキストの理解 \{#understanding-context\}

これらのメトリクスは、エージェントが与えられたコンテキストをどれだけ適切に活用しているかを評価します：

* [`context-position`](/docs/reference/evals/context-position)：レスポンス内でコンテキストがどこに現れるかを分析
* [`context-precision`](/docs/reference/evals/context-precision)：コンテキストのチャンクが論理的にまとめられているかを評価
* [`context-relevancy`](/docs/reference/evals/context-relevancy)：適切なコンテキスト要素が用いられているかを測定
* [`contextual-recall`](/docs/reference/evals/contextual-recall)：コンテキスト活用の網羅性を評価

### 出力品質 \{#output-quality\}

これらの指標は、書式やスタイル要件への適合度を評価します:

* [`tone`](/docs/reference/evals/tone-consistency): 丁寧さ、複雑さ、文体の一貫性を測定
* [`toxicity`](/docs/reference/evals/toxicity): 有害または不適切な内容を検出
* [`bias`](/docs/reference/evals/bias): 出力に潜在する偏りを検出
* [`prompt-alignment`](/docs/reference/evals/prompt-alignment): 文字数制限、書式要件、その他の制約など、明示的な指示への遵守状況を確認
* [`summarization`](/docs/reference/evals/summarization): 情報の保持と要約の簡潔さを評価
* [`keyword-coverage`](/docs/reference/evals/keyword-coverage): 専門用語の網羅状況を評価