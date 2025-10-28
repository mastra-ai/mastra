---
title: "エージェント駆動型のメタデータフィルタリング"
description: RAGシステムでMastraエージェントを用いて、ドキュメント検索のためのメタデータフィルターを構築・適用する方法の例。
---

# エージェント主導のメタデータフィルタリング \{#agent-driven-metadata-filtering\}

この例では、Mastra、OpenAI の埋め込み、PGVector（ベクトルストア）を用いて、Retrieval-Augmented Generation（RAG）システムを実装する方法を示します。
このシステムでは、エージェントがユーザーのクエリからメタデータフィルタを生成し、ベクトルストア内の関連チャンクを検索することで、返却される結果を絞り込みます。

## 概要 \{#overview\}

このシステムは、Mastra と OpenAI を用いてメタデータのフィルタリングを実装します。具体的には次のことを行います:

1. クエリを理解し、フィルタ要件を特定するために gpt-4o-mini を使った Mastra エージェントをセットアップする
2. メタデータのフィルタリングとセマンティック検索を行うためのベクトルクエリツールを作成する
3. ドキュメントをメタデータと埋め込み付きのチャンクに分割して処理する
4. 効率的な検索のために、ベクトルとメタデータの両方を PGVector に保存する
5. メタデータフィルタとセマンティック検索を組み合わせてクエリを処理する

ユーザーが質問すると:

* エージェントがクエリを分析して意図を把握する
* 適切なメタデータフィルタ（例: トピック、日付、カテゴリ）を構築する
* 最も関連性の高い情報を見つけるためにベクトルクエリツールを使用する
* フィルタリングされた結果に基づいて文脈に即した回答を生成する

## セットアップ \{#setup\}

### 環境のセットアップ \{#environment-setup\}

環境変数を設定してください：

```bash filename=".env"
OPENAI_API_KEY=your_openai_api_key_here
POSTGRES_CONNECTION_STRING=your_connection_string_here
```

### 依存関係 \{#dependencies\}

次に、必要な依存パッケージをインポートします：

```typescript copy showLineNumbers filename="index.ts"
import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PgVector, PGVECTOR_PROMPT } from '@mastra/pg';
import { createVectorQueryTool, MDocument } from '@mastra/rag';
import { embedMany } from 'ai';
```

## ベクタークエリツールの作成 \{#vector-query-tool-creation\}

@mastra/rag からインポートした createVectorQueryTool を使用すると、メタデータのフィルタリングに対応したツールを作成できます。各ベクターストアには、サポートするフィルタ演算子や構文を定義する固有のプロンプトがあります。

```typescript copy showLineNumbers{9} filename="index.ts"
const vectorQueryTool = createVectorQueryTool({
  id: 'vectorQueryTool',
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
  enableFilter: true,
});
```

各プロンプトには次が含まれます:

* 対応する演算子（比較、配列、論理、要素）
* 各演算子の利用例
* ストア固有の制約とルール
* 複雑なクエリの例

## ドキュメント処理 \{#document-processing\}

ドキュメントを作成し、メタデータ付きのチャンクに分割して処理します：

```typescript copy showLineNumbers{17} filename="index.ts"
const doc = MDocument.fromText(`気候変動が世界の農業に与える影響...`);

const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 512,
  overlap: 50,
  separator: '\n',
  extract: {
    keywords: true, // 各チャンクからキーワードを抽出
  },
});
```

### チャンクをメタデータに変換する \{#transform-chunks-into-metadata\}

チャンクを、フィルタ可能なメタデータに変換します:

```typescript copy showLineNumbers{31} filename="index.ts"
const chunkMetadata = chunks?.map((chunk: any, index: number) => ({
  text: chunk.text,
  ...chunk.metadata,
  nested: {
    keywords: chunk.metadata.excerptKeywords
      .replace('KEYWORDS:', '')
      .split(',')
      .map(k => k.trim()),
    id: index,
  },
}));
```

## エージェントの構成 \{#agent-configuration\}

エージェントはユーザーの問い合わせを理解し、適切なメタデータフィルターへと変換するように設定されています。

エージェントには、ベクトルクエリツールと、次の内容を含むシステムプロンプトの両方が必要です:

* 利用可能なフィルターフィールドのメタデータ構造
* フィルター処理と構文に関するベクトルストア向けプロンプト

```typescript copy showLineNumbers{43} filename="index.ts"
export const ragAgent = new Agent({
  name: 'RAG Agent',
  model: openai('gpt-4o-mini'),
  instructions: `
  あなたは提供されたコンテキストに基づいて質問に答える有用なアシスタントです。回答は簡潔かつ関連性の高いものにしてください。

  メタデータを検索してコンテキストをフィルタリングしてください。
  
  メタデータは以下のように構造化されています:

  {
    text: string,
    excerptKeywords: string,
    nested: {
      keywords: string[],
      id: number,
    },
  }

  ${PGVECTOR_PROMPT}

  重要: 質問に答えるよう求められた場合は、ツールで提供されたコンテキストのみに基づいて回答してください。
  コンテキストに質問へ完全に答えるための十分な情報が含まれていない場合は、そのことを明示的に述べてください。
  `,
  tools: { vectorQueryTool },
});
```

エージェントの指示は次のことを目的としています：

* ユーザーのクエリを処理してフィルター条件を特定する
* メタデータ構造を利用して関連情報を特定する
* vectorQueryTool と提供されたベクトルストア用プロンプトを用いて適切なフィルターを適用する
* フィルタリングされたコンテキストに基づいて回答を生成する

> 注記: ベクトルストアごとに固有のプロンプトが用意されています。詳細は [Vector Store Prompts](/docs/rag/retrieval#vector-store-prompts) を参照してください。

## PgVector と Mastra の初期化 \{#instantiate-pgvector-and-mastra\}

以下のコンポーネントを使用して PgVector と Mastra を初期化します:

```typescript copy showLineNumbers{69} filename="index.ts"
const pgVector = new PgVector({
  connectionString: process.env.POSTGRES_CONNECTION_STRING!,
});

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
});
const agent = mastra.getAgent('ragAgent');
```

## 埋め込みの作成と保存 \{#creating-and-storing-embeddings\}

埋め込みを生成し、メタデータとともに保存します。

```typescript copy showLineNumbers{78} filename="index.ts"
const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

const vectorStore = mastra.getVector('pgVector');
await vectorStore.createIndex({
  indexName: 'embeddings',
  dimension: 1536,
});

// 埋め込みとメタデータをまとめて保存する
await vectorStore.upsert({
  indexName: 'embeddings',
  vectors: embeddings,
  metadata: chunkMetadata,
});
```

`upsert` 操作は、ベクトル埋め込みとそれに対応するメタデータの両方を保存し、セマンティック検索とメタデータによるフィルタリングを組み合わせた検索を可能にします。

## メタデータベースのクエリ \{#metadata-based-querying\}

メタデータのフィルターを使って、さまざまなクエリを試してみましょう：

```typescript copy showLineNumbers{96} filename="index.ts"
const queryOne = '言及されている適応戦略は何ですか？';
const answerOne = await agent.generate(queryOne);
console.log('\nQuery:', queryOne);
console.log('Response:', answerOne.text);

const queryTwo = '最近のセクションを表示してください。「nested.id」フィールドを確認し、2より大きい値のみを返してください。';
const answerTwo = await agent.generate(queryTwo);
console.log('\nQuery:', queryTwo);
console.log('Response:', answerTwo.text);

const queryThree = '「text」フィールドを正規表現演算子で検索し、「temperature」を含むセクションを探してください。';
const answerThree = await agent.generate(queryThree);
console.log('\nQuery:', queryThree);
console.log('Response:', answerThree.text);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/filter-rag"
}
/>
