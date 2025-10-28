---
title: "ベクトルクエリツールの使い方"
description: OpenAI の埋め込みと PGVector（ベクトル格納）を用いて、Mastra で基本的な RAG システムを実装する例。
---

# Vector Query Tool の使用 \{#using-the-vector-query-tool\}

この例では、RAG システムでのセマンティック検索に `createVectorQueryTool` を実装して活用する方法を紹介します。ツールの設定、ベクター保存の管理、そして関連するコンテキストを効率的に取得する方法を示します。

## 概要 \{#overview\}

このシステムは Mastra と OpenAI を用いて RAG を実装しています。主な処理は次のとおりです。

1. 応答生成のために gpt-4o-mini を用いた Mastra エージェントを設定する
2. ベクターストアとのやり取りを管理するためのベクタークエリツールを作成する
3. 既存の埋め込みを用いて関連コンテキストを取得する
4. Mastra エージェントでコンテキストを考慮した応答を生成する

> 注: 埋め込みの作成と保存方法は、[Upsert Embeddings](/docs/examples/rag/upsert/upsert-embeddings) ガイドをご覧ください。

## セットアップ \{#setup\}

### 環境のセットアップ \{#environment-setup\}

環境変数を設定してください。

```bash filename=".env"
OPENAI_API_KEY=your_openai_api_key_here
POSTGRES_CONNECTION_STRING=your_connection_string_here
```

### 依存関係 \{#dependencies\}

必要な依存関係をインポートします：

```typescript copy showLineNumbers filename="src/index.ts"
import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createVectorQueryTool } from '@mastra/rag';
import { PgVector } from '@mastra/pg';
```

## ベクタークエリツールの作成 \{#vector-query-tool-creation\}

ベクターデータベースに対してクエリを実行するツールを作成します。

```typescript copy showLineNumbers{7} filename="src/index.ts"
const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
});
```

## エージェントの構成 \{#agent-configuration\}

応答を処理する Mastra エージェントを設定します：

```typescript copy showLineNumbers{13} filename="src/index.ts"
export const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions:
    '提供されたコンテキストに基づいて質問に答える有用なアシスタントです。回答は簡潔かつ関連性の高いものにしてください。',
  model: openai('gpt-4o-mini'),
  tools: {
    vectorQueryTool,
  },
});
```

## PgVector と Mastra のインスタンス化 \{#instantiate-pgvector-and-mastra\}

すべてのコンポーネントを指定して、PgVector と Mastra のインスタンスを生成します:

```typescript copy showLineNumbers{23} filename="src/index.ts"
const pgVector = new PgVector({
  connectionString: process.env.POSTGRES_CONNECTION_STRING!,
});

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
});

const agent = mastra.getAgent('ragAgent');
```

## 使用例 \{#example-usage\}

```typescript copy showLineNumbers{32} filename="src/index.ts"
const prompt = `
[ここにドキュメントに基づくクエリを挿入]
ツールで提供されたコンテキストのみに基づいて回答してください。
コンテキストに質問に完全に答えるための十分な情報が含まれていない場合は、その旨を明示してください。
`;

const completion = await agent.generate(prompt);
console.log(completion.text);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/basic-rag"
}
/>
