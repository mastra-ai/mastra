---
title: "ツールを用いた結果のリランキング"
description: Mastra で OpenAI の埋め込みと PGVector によるベクトル保存を利用し、リランキング付きの RAG システムを実装する例。
---

# ツールを使った再ランキングの結果 \{#re-ranking-results-with-tools\}

この例では、Mastra のベクタークエリツールを用いて、OpenAI の埋め込み表現と PGVector を使ったベクター保存を組み合わせ、再ランキング機能付きの Retrieval-Augmented Generation（RAG）システムを実装する方法を示します。

## 概要 \{#overview\}

このシステムは、Mastra と OpenAI を用いて再ランキング付きの RAG を実装しています。主な処理は次のとおりです。

1. 応答生成のために gpt-4o-mini を用いた Mastra エージェントをセットアップする
2. 再ランキング機能を備えたベクター検索ツールを作成する
3. テキストドキュメントを小さなチャンクに分割し、埋め込みを作成する
4. 埋め込みを PostgreSQL のベクターデータベースに保存する
5. クエリに基づいて関連チャンクを検索し、再ランキングする
6. Mastra エージェントでコンテキストを考慮した応答を生成する

## セットアップ \{#setup\}

### 環境設定 \{#environment-setup\}

環境変数を必ず設定してください：

```bash filename=".env"
OPENAI_API_KEY=あなたのOpenAI APIキーをここに入力
POSTGRES_CONNECTION_STRING=あなたの接続文字列をここに入力
```

### 依存関係 \{#dependencies\}

次に、必要な依存パッケージをインポートします。

```typescript copy showLineNumbers filename="index.ts"
import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PgVector } from '@mastra/pg';
import { MDocument, createVectorQueryTool, MastraAgentRelevanceScorer } from '@mastra/rag';
import { embedMany } from 'ai';
```

## 再ランキング対応ベクタークエリツールの作成 \{#vector-query-tool-creation-with-re-ranking\}

@mastra/rag からインポートした createVectorQueryTool を使うと、ベクターデータベースに対してクエリを実行し、結果を再ランキングするツールを作成できます。

```typescript copy showLineNumbers{8} filename="index.ts"
const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
  reranker: {
    model: new MastraAgentRelevanceScorer('relevance-scorer', openai('gpt-4o-mini')),
  },
});
```

## エージェントの設定 \{#agent-configuration\}

応答を処理する Mastra エージェントを設定します：

```typescript copy showLineNumbers{17} filename="index.ts"
export const ragAgent = new Agent({
  name: 'RAG エージェント',
  instructions: `あなたは、提供されたコンテキストに基づいて質問に回答する、役に立つアシスタントです。回答は簡潔で要点を押さえたものにしてください。
    重要: 質問に回答するときは、ツールで提供されたコンテキストのみに基づいて回答してください。 
    コンテキストに質問へ完全に答えるのに十分な情報が含まれていない場合は、その旨をはっきりと述べてください。`,
  model: openai('gpt-4o-mini'),
  tools: {
    vectorQueryTool,
  },
});
```

## PgVector と Mastra のインスタンス化 \{#instantiate-pgvector-and-mastra\}

以下のコンポーネントを用いて PgVector と Mastra をインスタンス化します：

```typescript copy showLineNumbers{29} filename="index.ts"
const pgVector = new PgVector({
  connectionString: process.env.POSTGRES_CONNECTION_STRING!,
});

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
});

const agent = mastra.getAgent('ragAgent');
```

## ドキュメント処理 \{#document-processing\}

ドキュメントを作成し、チャンクに分割して処理します。

```typescript copy showLineNumbers{38} filename="index.ts"
const doc1 = MDocument.fromText(`
市場データは価格のレジスタンス水準を示す。
テクニカルチャートは移動平均を表示する。
サポート水準は売買判断の指針となる。
ブレイクアウトパターンはエントリーポイントのシグナルとなる。
プライスアクションが取引のタイミングを決定する。

ベースボールカードは徐々に価値が上昇する。
ルーキーカードはプレミアム価格で取引される。
カードの状態は再販価値に影響する。
真贋鑑定が偽造取引を防ぐ。
グレーディングサービスがカードの品質を検証する。

出来高分析が価格トレンドを裏付ける。
スポーツカードは季節的な需要を反映する。
チャートパターンは値動きを予測する。
ミントコンディションでカード価値は倍増する。
レジスタンス突破で注文が発動する。
レアカードは毎年値上がりする。
`);

const chunks = await doc1.chunk({
  strategy: 'recursive',
  size: 150,
  overlap: 20,
  separator: '\n',
});
```

## 埋め込みの作成と保存 \{#creating-and-storing-embeddings\}

チャンクごとに埋め込みを生成し、ベクターデータベースに保存します。

```typescript copy showLineNumbers{66} filename="index.ts"
const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

const vectorStore = mastra.getVector('pgVector');
await vectorStore.createIndex({
  indexName: 'embeddings',
  dimension: 1536,
});

await vectorStore.upsert({
  indexName: 'embeddings',
  vectors: embeddings,
  metadata: chunks?.map((chunk: any) => ({ text: chunk.text })),
});
```

## リランキングによるクエリ実行 \{#querying-with-re-ranking\}

リランキングが結果にどう影響するかを確かめるため、異なるクエリを試してみてください。

```typescript copy showLineNumbers{82} filename="index.ts"
const queryOne = 'テクニカルトレーディング分析について説明してください';
const answerOne = await agent.generate(queryOne);
console.log('\nクエリ:', queryOne);
console.log('応答:', answerOne.text);

const queryTwo = 'トレーディングカードの評価について説明してください';
const answerTwo = await agent.generate(queryTwo);
console.log('\nクエリ:', queryTwo);
console.log('応答:', answerTwo.text);

const queryThree = 'マーケットレジスタンスをどのように分析しますか';
const answerThree = await agent.generate(queryThree);
console.log('\nクエリ:', queryThree);
console.log('応答:', answerThree.text);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/rerank-rag"
}
/>
