---
title: "概要"
description: "Mastra の評価ツール（evals）を使って、AI エージェントの品質を評価・測定する方法を理解する。"
sidebar_position: 1
---

# evals を使ったエージェントのテスト \{#testing-your-agents-with-evals\}

:::info 新しい Scorer API

より扱いやすい API、エラー分析に役立つ豊富なメタデータ、データ構造の評価における柔軟性を備えた新しい evals API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

従来のソフトウェアテストには明確な合否基準がありますが、AI の出力は非決定的で、同じ入力でも変動します。evals は、エージェントの品質を測定するための定量的な指標を提供することで、このギャップを埋めます。

evals は、モデル採点、ルールベース、統計的手法を用いてエージェントの出力を評価する自動テストです。各 eval は、ログ記録や比較が可能な 0〜1 の正規化スコアを返します。evals は独自のプロンプトやスコアリング関数でカスタマイズできます。

evals はクラウドで実行でき、結果をリアルタイムで取得できます。また、CI/CD パイプラインに組み込むことで、時間の経過に伴うエージェントのテストと監視も可能です。

## Evals の種類 \{#types-of-evals\}

目的に応じてさまざまな種類の evals があり、以下は一般的なタイプです。

1. **Textual Evals**: エージェントの応答における正確性・信頼性・文脈理解を評価する
2. **Classification Evals**: 事前に定義されたカテゴリーに基づくデータ分類の正確性を測定する
3. **Prompt Engineering Evals**: 指示内容や入力形式の違いが与える影響を検証する

## インストール \{#installation\}

Mastra の evals 機能を利用するには、`@mastra/evals` パッケージをインストールしてください。

```bash copy
npm install @mastra/evals@latest
```

## はじめに \{#getting-started\}

Evals はエージェントに追加して使用します。以下は、要約、コンテンツ類似度、トーンの一貫性といった指標を使った例です：

```typescript copy showLineNumbers filename="src/mastra/agents/index.ts"
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { SummarizationMetric } from '@mastra/evals/llm';
import { ContentSimilarityMetric, ToneConsistencyMetric } from '@mastra/evals/nlp';

const model = openai('gpt-4o');

export const myAgent = new Agent({
  name: 'ContentWriter',
  instructions: '正確な要約を作成するコンテンツライターとして動作してください',
  model,
  evals: {
    summarization: new SummarizationMetric(model),
    contentSimilarity: new ContentSimilarityMetric(),
    tone: new ToneConsistencyMetric(),
  },
});
```

`mastra dev` を使用中は、Mastra ダッシュボードで eval の結果を確認できます。

## 自動テストの先へ \{#beyond-automated-testing\}

自動評価（eval）は有用ですが、優秀な AI チームは次の取り組みと組み合わせることがよくあります：

1. **A/B テスト**：実ユーザーで異なるバージョンを比較する
2. **人によるレビュー**：本番データやトレースを定期的に見直す
3. **継続的モニタリング**：退行を検知するため、評価指標（eval）の推移を継続的に追跡する

## Eval 結果の理解 \{#understanding-eval-results\}

各 eval 指標は、エージェントの出力の特定の側面を測定します。結果の読み解き方と改善のポイントは次のとおりです。

### スコアを理解する \{#understanding-scores\}

任意の指標について:

1. スコアリングの仕組みを把握するため、指標のドキュメントを確認する
2. スコアが変動するタイミングや要因のパターンを見つける
3. 入力やコンテキストが異なる場合のスコアを比較する
4. 時系列で変化を追い、傾向を把握する

### 結果を改善する \{#improving-results\}

スコアが目標に届かない場合:

1. 指示を見直す - 明確ですか？ さらに具体的にしてみましょう
2. コンテキストを確認する - エージェントに必要な情報を提供できていますか？
3. プロンプトを簡潔にする - 複雑なタスクは小さなステップに分ける
4. ガードレールを設ける - 難しいケースに対応する具体的なルールを追加する

### 品質の維持 \{#maintaining-quality\}

目標を達成できるようになったら、次を行いましょう:

1. 安定性を監視する - スコアは安定しているか？
2. 有効な手法を記録する - 成功したアプローチをメモしておく
3. 端（エッジ）ケースをテストする - 非常時・例外的なシナリオをカバーする例を追加する
4. 微調整する - さらなる効率化の余地を探す

evals ができることの詳細は [Textual Evals](/docs/scorers/evals/textual-evals) を参照してください。

独自の evals を作成する方法については、[Custom Evals](/docs/scorers/evals/custom-eval) ガイドを参照してください。

CI パイプラインで evals を実行するには、[Running in CI](/docs/scorers/evals/running-in-ci) ガイドを参照してください。