---
title: "Graph RAG システム完全版"
description: OpenAI のエンベディングと PGVector（ベクトルストア）を用いて、Mastra で Graph RAG システムを実装する例。
---

# Graph RAG \{#graph-rag\}

この例では、Mastra、OpenAI の埋め込み、そしてベクトル格納に PGVector を用いて、Retrieval-Augmented Generation（RAG）システムを実装する方法を示します。

## 概要 \{#overview\}

このシステムは Mastra と OpenAI を用いて Graph RAG を実装しています。主な処理は次のとおりです。

1. 応答生成に gpt-4o-mini を用いる Mastra エージェントをセットアップ
2. ベクターストアとのやり取りおよびナレッジグラフの作成・走査を管理する GraphRAG ツールを作成
3. テキストドキュメントを小さな単位に分割
4. それらのチャンクに対して埋め込みを作成
5. PostgreSQL のベクターデータベースに保存
6. GraphRAG ツールを用いて、クエリに基づき関連するチャンクのナレッジグラフを作成
   * ツールはベクターストアから結果を返し、ナレッジグラフを生成
   * クエリに基づいてナレッジグラフを走査
7. Mastra エージェントを使って文脈に即した応答を生成

## 設定 \{#setup\}

### 環境設定 \{#environment-setup\}

環境変数を必ず設定してください：

```bash filename=".env"
OPENAI_API_KEY=your_openai_api_key_here
POSTGRES_CONNECTION_STRING=your_connection_string_here
```

### 依存関係 \{#dependencies\}

次に、必要な依存関係をインポートします。

```typescript copy showLineNumbers filename="index.ts"
import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PgVector } from '@mastra/pg';
import { MDocument, createGraphRAGTool } from '@mastra/rag';
import { embedMany } from 'ai';
```

## GraphRAG ツールの作成 \{#graphrag-tool-creation\}

@mastra/rag からインポートした createGraphRAGTool を使うと、ベクターデータベースにクエリを実行し、結果をナレッジグラフに変換するツールを作成できます：

```typescript copy showLineNumbers{8} filename="index.ts"
const graphRagTool = createGraphRAGTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
  graphOptions: {
    dimension: 1536,
    threshold: 0.7,
  },
});
```

## エージェントの設定 \{#agent-configuration\}

応答を扱う Mastra エージェントを設定します:

```typescript copy showLineNumbers{19} filename="index.ts"
const ragAgent = new Agent({
  name: 'GraphRAG エージェント',
  instructions: `あなたは、提供されたコンテキストに基づいて質問に答える有用なアシスタントです。次の形式で回答してください:

1. 直接の事実: 質問に関連するテキスト中の、明示的に述べられた事実のみを列挙（2〜3項目の箇条書き）
2. 発見したつながり: テキスト内の異なる部分どうしの関係を列挙（2〜3項目の箇条書き）
3. 結論: すべてを結びつける一文の要約

各セクションは簡潔にし、最重要点に絞って記述してください。

重要: 質問に回答する際は、ツールで提供されたコンテキストのみに基づいてください。 
コンテキストに質問へ完全に回答するのに十分な情報がない場合は、その旨を明確に述べてください。`,
  model: openai('gpt-4o-mini'),
  tools: {
    graphRagTool,
  },
});
```

## PgVector と Mastra をインスタンス化する \{#instantiate-pgvector-and-mastra\}

以下のコンポーネントを使用して PgVector と Mastra をインスタンス化します:

```typescript copy showLineNumbers{36} filename="index.ts"
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

```typescript copy showLineNumbers{45} filename="index.ts"
const doc = MDocument.fromText(`
# Riverdale Heights: コミュニティ開発調査
// ... テキストコンテンツ ...
`);

const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 512,
  overlap: 50,
  separator: '\n',
});
```

## 埋め込みの作成と保存 \{#creating-and-storing-embeddings\}

チャンクの埋め込みを生成し、ベクトルデータベースに保存します。

```typescript copy showLineNumbers{56} filename="index.ts"
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

## グラフベースのクエリ \{#graph-based-querying\}

データの関係性を探索するために、さまざまなクエリを試してみましょう。

```typescript copy showLineNumbers{82} filename="index.ts"
const queryOne =
  "Riverdale Heightsの現状に対する初期の鉄道決定による直接的および間接的な影響は何ですか?";
const answerOne = await ragAgent.generate(queryOne);
console.log('\nクエリ:', queryOne);
console.log('レスポンス:', answerOne.text);

const queryTwo =
  '交通インフラの変化は、地元企業やコミュニティスペースの世代ごとにどのような影響を与えましたか?';
const answerTwo = await ragAgent.generate(queryTwo);
console.log('\nクエリ:', queryTwo);
console.log('レスポンス:', answerTwo.text);

const queryThree =
  'Rossi家のビジネスとThompson Steel Worksが主要なインフラ変化にどのように対応したか、そしてその対応がコミュニティに与えた影響を比較してください。';
const answerThree = await ragAgent.generate(queryThree);
console.log('\nクエリ:', queryThree);
console.log('レスポンス:', answerThree.text);

const queryFour =
  'Thompson Steel Works跡地の変遷が1932年から現在まで周辺のビジネスや文化スペースに与えた影響を追跡してください。';
const answerFour = await ragAgent.generate(queryFour);
console.log('\nクエリ:', queryFour);
console.log('レスポンス:', answerFour.text);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/graph-rag"
}
/>
