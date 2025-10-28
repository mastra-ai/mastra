---
title: "概要"
description: Mastra におけるスコアラーの概要。AI の出力を評価し、性能を測定するための機能を詳しく解説します。
sidebar_position: 1
---

# スコアラーの概要 \{#scorers-overview\}

**スコアラー**は、AI が生成した出力の品質、正確性、パフォーマンスを測定する評価ツールです。特定の基準に基づいて応答を分析し、エージェント、ワークフロー、言語モデルが望ましい結果を生み出しているかを自動的に評価します。

**スコア**は、出力が評価基準をどの程度満たしているかを数値化した指標（通常は 0〜1）です。これらのスコアにより、パフォーマンスを客観的に把握し、異なるアプローチを比較し、AI システムの改善点を特定できます。

## 評価パイプライン \{#evaluation-pipeline\}

Mastra のスコアラーは、シンプルなものから複雑なものまで対応できる柔軟な4段階のパイプラインに従います。

1. **preprocess**（任意）：評価のために入出力データを準備・変換する
2. **analyze**（任意）：評価を分析し、示唆を得る
3. **generateScore**（必須）：分析結果を数値スコアに変換する
4. **generateReason**（任意）：スコアの説明や根拠を生成する

このモジュール構造により、単一ステップのシンプルな評価から複数段階の複雑な分析ワークフローまで対応でき、ニーズに合った評価を構築できます。

### 各ステップを使うタイミング \{#when-to-use-each-step\}

**preprocess ステップ** - コンテンツが複雑な場合や前処理が必要な場合に使用:

* 複雑なデータ構造から特定要素を抽出する
* 解析前にテキストをクリーニングや正規化する
* 個別評価が必要な複数の主張を解析する
* 関連セクションに評価を絞り込むためにコンテンツをフィルタリングする

**analyze ステップ** - 構造化された評価用の分析が必要な場合に使用:

* スコア判断に役立つインサイトを収集する
* 複雑な評価基準を要素に分解する
* generateScore が用いる詳細な分析を実施する
* 透明性のための根拠や推論データを収集する

**generateScore ステップ** - 分析をスコアに変換するために常に必要:

* シンプルなケース: 入力/出力ペアを直接スコアリング
* 複雑なケース: 詳細な分析結果を数値スコアへ変換
* 分析結果にビジネスロジックや重み付けを適用
* 最終的な数値スコアを生成する唯一のステップ

**generateReason ステップ** - 説明が重要な場合に使用:

* なぜそのスコアになったのかをユーザーに理解してもらう必要がある
* デバッグや透明性が重要である
* コンプライアンスや監査で説明が求められる
* 改善に向けた実行可能なフィードバックを提供する

独自の Scorer の作成方法については、[Creating Custom Scorers](/docs/scorers/custom-scorers) を参照してください。

## インストール \{#installation\}

Mastra のスコアラー機能にアクセスするには、`@mastra/evals` パッケージをインストールしてください。

```bash copy
npm install @mastra/evals@latest
```

## ライブ評価 \{#live-evaluations\}

**ライブ評価**を使うと、エージェントやワークフローの稼働中に、AIの出力をリアルタイムで自動評価できます。評価を手動やバッチで実行するのではなく、評価器がAIシステムと並行して非同期に動作し、継続的な品質監視を実現します。

### エージェントにスコアラーを追加する \{#adding-scorers-to-agents\}

エージェントに組み込みスコアラーを追加して、出力を自動的に評価できます。利用可能なオプションは、[組み込みスコアラーの一覧](/docs/scorers/off-the-shelf-scorers)をご覧ください。

```typescript filename="src/mastra/agents/evaluated-agent.ts" showLineNumbers copy
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { createAnswerRelevancyScorer, createToxicityScorer } from '@mastra/evals/scorers/llm';

export const evaluatedAgent = new Agent({
  // ...
  scorers: {
    relevancy: {
      scorer: createAnswerRelevancyScorer({ model: openai('gpt-4o-mini') }),
      sampling: { type: 'ratio', rate: 0.5 },
    },
    safety: {
      scorer: createToxicityScorer({ model: openai('gpt-4o-mini') }),
      sampling: { type: 'ratio', rate: 1 },
    },
  },
});
```

### ワークフローのステップにスコアラーを追加する \{#adding-scorers-to-workflow-steps\}

プロセス内の特定のタイミングで出力を評価するために、個々のワークフローのステップにスコアラーを追加することもできます。

```typescript filename="src/mastra/workflows/content-generation.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { customStepScorer } from "../scorers/custom-step-scorer";

const contentStep = createStep({
  // ...
  scorers: {
    customStepScorer: {
      scorer: customStepScorer(),
      sampling: {
        type: "ratio",
        rate: 1, // すべてのステップ実行をスコア付け
      }
    }
  },
});

export const contentWorkflow = createWorkflow({ ... })
  .then(contentStep)
  .commit();
```

### ライブ評価の仕組み \{#how-live-evaluations-work\}

**非同期実行**: ライブ評価はバックグラウンドで動作し、エージェントの応答やワークフローの実行を妨げません。これにより、監視しながらも AI システムのパフォーマンスを維持できます。

**サンプリング制御**: `sampling.rate` パラメータ（0〜1）は、採点対象となる出力の割合を制御します:

* `1.0`: すべての応答を採点（100%）
* `0.5`: 応答の半分を採点（50%）
* `0.1`: 応答の 10% を採点
* `0.0`: 採点を無効化

**自動保存**: すべての採点結果は、設定済みデータベース内の `mastra_scorers` テーブルに自動的に保存され、経時的なパフォーマンスの傾向を分析できます。

## トレースの評価 \{#trace-evaluations\}

ライブ評価に加えて、スコアラーを使用してエージェントの対話やワークフローから得られた過去のトレースを評価できます。これは、過去のパフォーマンス分析、問題のデバッグ、バッチ評価の実行に特に有用です。

:::note 観測性が必要です

トレースにスコアを付けるには、まず Mastra インスタンスで観測性を設定し、トレースデータを収集する必要があります。セットアップ手順については、[AI トレーシングのドキュメント](/docs/observability/ai-tracing/overview)を参照してください。

:::

### Playground を使ってトレースをスコアリングする \{#scoring-traces-with-the-playground\}

トレースにスコアを付与するには、まず Mastra インスタンスにスコアラーを登録する必要があります。

```typescript
const mastra = new Mastra({
  // ...
  scorers: {
    answerRelevancy: myAnswerRelevancyScorer,
    responseQuality: myResponseQualityScorer,
  },
});
```

登録が完了すると、Mastra のプレイグラウンド内の Observability セクションで、トレースに対してインタラクティブにスコア付けできます。これにより、過去のトレースに対してスコアラーを実行するための使いやすいインターフェースが提供されます。

## ローカルでスコアラーをテストする \{#testing-scorers-locally\}

Mastra では、CLI コマンド `mastra dev` を使ってスコアラーをテストできます。Playground にはスコアラー用のセクションがあり、各スコアラーをテスト入力に対して実行し、詳細な結果を確認できます。

詳しくは、[ローカル開発用 Playground](/docs/getting-started/local-dev-playground) のドキュメントをご覧ください。

## 次のステップ \{#next-steps\}

* [Creating Custom Scorers](/docs/scorers/custom-scorers) ガイドで独自のスコアラーの作成方法を学ぶ
* [Off-the-shelf Scorers](/docs/scorers/off-the-shelf-scorers) セクションで標準搭載のスコアラーを確認する
* [Local Dev Playground](/docs/getting-started/local-dev-playground) でスコアラーを試す
* [Examples Overview](/docs/examples) セクションでスコアラーの例を確認する