---
title: "情報密度の最適化"
description: LLM ベースの処理を用いて、情報密度を最適化し、データの重複を排除する RAG システムを Mastra で実装する例。
---

# 情報密度の最適化 \{#optimizing-information-density\}

この例では、Mastra、OpenAIの埋め込み表現、そしてベクトル格納にPGVectorを用いて、Retrieval-Augmented Generation（RAG）システムを実装する方法を示します。
本システムでは、情報密度を高めて重複データを除去するため、エージェントが初期チャンクをクリーンアップします。

## 概要 \{#overview\}

このシステムは Mastra と OpenAI を用いて RAG を実装し、今回は LLM ベースの処理で情報密度を最適化します。具体的には次のことを行います:

1. クエリ処理とドキュメントのクレンジングの両方に対応できる gpt-4o-mini を使った Mastra エージェントをセットアップ
2. エージェントが利用するベクトル検索とドキュメント分割のツールを作成
3. 初期ドキュメントを処理:
   * テキストドキュメントを小さなチャンクに分割
   * 各チャンクの埋め込みを生成
   * PostgreSQL のベクトルデータベースに格納
4. ベースラインの応答品質を把握するために初回クエリを実行
5. データを最適化:
   * エージェントでチャンクをクレンジングし、重複を除去
   * クレンジング後のチャンクに対して新たに埋め込みを生成
   * 最適化したデータでベクトルストアを更新
6. 応答品質の改善を示すため、同じクエリを再度実行

## セットアップ \{#setup\}

### 環境のセットアップ \{#environment-setup\}

環境変数を必ず設定してください。

```bash filename=".env"
OPENAI_API_KEY=your_openai_api_key_here
POSTGRES_CONNECTION_STRING=your_connection_string_here
```

### 依存関係 \{#dependencies\}

次に、必要な依存項目をインポートします。

```typescript copy showLineNumbers filename="index.ts"
import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PgVector } from '@mastra/pg';
import { MDocument, createVectorQueryTool, createDocumentChunkerTool } from '@mastra/rag';
import { embedMany } from 'ai';
```

## ツールの作成 \{#tool-creation\}

### ベクタークエリツール \{#vector-query-tool\}

@mastra/rag からインポートした createVectorQueryTool を使うと、ベクターデータベースに対してクエリを実行できるツールを作成できます。

```typescript copy showLineNumbers{8} filename="index.ts"
const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
});
```

### ドキュメント分割ツール \{#document-chunker-tool\}

@mastra/rag からインポートした createDocumentChunkerTool を使うと、ドキュメントをチャンク（分割）し、そのチャンクをエージェントに送信するツールを作成できます。

```typescript copy showLineNumbers{14} filename="index.ts"
const doc = MDocument.fromText(yourText);

const documentChunkerTool = createDocumentChunkerTool({
  doc,
  params: {
    strategy: 'recursive',
    size: 512,
    overlap: 25,
    separator: '\n',
  },
});
```

## エージェントの設定 \{#agent-configuration\}

問い合わせとクレンジングの両方に対応できる単一の Mastra エージェントを設定します。

```typescript copy showLineNumbers{26} filename="index.ts"
const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions: `あなたは文書の検索とクリーニングの両方を処理する有用なアシスタントです。
    クリーニング時:データを処理、クリーニング、ラベル付けし、不要な情報を削除し、重要な事実を保持しながら重複コンテンツを排除します。
    検索時:利用可能なコンテキストに基づいて回答を提供します。回答は簡潔で関連性の高いものにしてください。
    
    重要:質問への回答を求められた場合は、ツールで提供されたコンテキストのみに基づいて回答してください。コンテキストに質問へ完全に答えるための十分な情報が含まれていない場合は、その旨を明示的に述べてください。
    `,
  model: openai('gpt-4o-mini'),
  tools: {
    vectorQueryTool,
    documentChunkerTool,
  },
});
```

## PgVector と Mastra をインスタンス化する \{#instantiate-pgvector-and-mastra\}

次のコンポーネントを使って PgVector と Mastra をインスタンス化します:

```typescript copy showLineNumbers{41} filename="index.ts"
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

元のドキュメントを分割し、埋め込みを生成します：

```typescript copy showLineNumbers{49} filename="index.ts"
const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 256,
  overlap: 50,
  separator: '\n',
});

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

## 初期クエリ \{#initial-query\}

まずはベースラインを把握するために、生データへクエリを投げてみましょう:

```typescript copy showLineNumbers{73} filename="index.ts"
// 元の埋め込みを使用してレスポンスを生成
const query = '宇宙探査について言及されているすべての技術は何ですか?';
const originalResponse = await agent.generate(query);
console.log('\nクエリ:', query);
console.log('レスポンス:', originalResponse.text);
```

## データ最適化 \{#data-optimization\}

初期結果を確認したうえで、品質向上のためにデータをクレンジングできます。

```typescript copy showLineNumbers{79} filename="index.ts"
const chunkPrompt = `提供されたツールを使用してチャンクをクリーニングしてください。宇宙に関連しない不要な情報を除外し、重複を削除してください。`;

const newChunks = await agent.generate(chunkPrompt);
const updatedDoc = MDocument.fromText(newChunks.text);

const updatedChunks = await updatedDoc.chunk({
  strategy: 'recursive',
  size: 256,
  overlap: 50,
  separator: '\n',
});

const { embeddings: cleanedEmbeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: updatedChunks.map(chunk => chunk.text),
});

// クリーニングされた埋め込みでベクトルストアを更新
await vectorStore.deleteIndex({ indexName: 'embeddings' });
await vectorStore.createIndex({
  indexName: 'embeddings',
  dimension: 1536,
});

await vectorStore.upsert({
  indexName: 'embeddings',
  vectors: cleanedEmbeddings,
  metadata: updatedChunks?.map((chunk: any) => ({ text: chunk.text })),
});
```

## 最適化されたクエリ \{#optimized-query\}

クリーンアップ後にデータを再度クエリし、応答に違いがあるかを確認します。

```typescript copy showLineNumbers{109} filename="index.ts"
// クリーニング済みの埋め込みで再度クエリを実行
const cleanedResponse = await agent.generate(query);
console.log('\nクエリ:', query);
console.log('レスポンス:', cleanedResponse.text);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/cleanup-rag"
}
/>
