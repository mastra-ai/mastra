---
title: "カスタム eval を作成する"
description: "Mastra では独自の eval を作成できます。作成方法をご紹介します。"
sidebar_position: 3
---

# カスタム Eval を作成する \{#create-a-custom-eval\}

:::info 新しい Scorer API

より使いやすい API、エラー分析のためのより多くのメタデータ、そしてデータ構造の評価に対する柔軟性を備えた Scorers という新しい evals API をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`Metric` クラスを拡張し、`measure` メソッドを実装してカスタム eval を作成します。これにより、スコアの算出方法と返す情報を完全に制御できます。LLM を用いた評価では、`MastraAgentJudge` クラスを拡張して、モデルの推論方法と出力の採点基準を定義します。

## ネイティブ JavaScript の評価 \{#native-javascript-evaluation\}

素の JavaScript/TypeScript を使って、軽量なカスタム指標を作成できます。単純な文字列比較、パターンチェック、その他のルールベースのロジックに最適です。

出力内で見つかった参照語の数に基づいて応答を採点する[Word Inclusion の例](/docs/examples/evals/custom-native-javascript-eval)をご覧ください。

## 審査員としての LLM による評価 \{#llm-as-a-judge-evaluation\}

より複雑な評価には、LLM を用いた審査員を構築できます。これにより、事実の正確性、トーン、推論といった、より微妙な基準も捉えられます。

実世界の事実の正確性を評価するカスタム審査員と指標の構築を一通り解説した[Real World Countries の例](/docs/examples/evals/custom-llm-judge-eval)をご覧ください。