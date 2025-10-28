---
title: "Chain-of-Thought プロンプティング"
description: OpenAI と PGVector を用いた Chain-of-Thought 推論による Mastra の RAG システム実装例。
---

# Chain of Thoughtプロンプティング \{#chain-of-thought-prompting\}

この例では、Mastra、OpenAIの埋め込みベクトル、PGVector（ベクトルストア）を用いて、思考の連鎖に基づく推論を重視したRetrieval-Augmented Generation（RAG）システムの実装方法を紹介します。

## 概要 \{#overview\}

このシステムは、Mastra と OpenAI を用い、思考連鎖（chain-of-thought）プロンプトを活用した RAG を実装しています。主な処理は以下のとおりです。

1. 応答生成用に gpt-4o-mini を使った Mastra エージェントをセットアップする
2. ベクターストアとのやり取りを管理するためのベクタークエリツールを作成する
3. テキストドキュメントを小さな単位に分割する
4. それらのチャンクに対して埋め込みを作成する
5. PostgreSQL のベクターデータベースに保存する
6. ベクタークエリツールでクエリに基づき関連するチャンクを取得する
7. 思考連鎖による推論を用いて、文脈に即した応答を生成する

## セットアップ \{#setup\}

### 環境設定 \{#environment-setup\}

環境変数を設定していることを確認してください:

```bash filename=".env"
OPENAI_API_KEY=あなたのOpenAI APIキーをここに入力
POSTGRES_CONNECTION_STRING=あなたの接続文字列をここに入力
```

### 依存関係 \{#dependencies\}

次に、必要な依存関係をインポートします。

```typescript copy showLineNumbers filename="index.ts"
import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PgVector } from '@mastra/pg';
import { createVectorQueryTool, MDocument } from '@mastra/rag';
import { embedMany } from 'ai';
```

## ベクタークエリツールの作成 \{#vector-query-tool-creation\}

@mastra/rag からインポートした createVectorQueryTool を使うと、ベクターデータベースに対してクエリを実行できるツールを作成できます。

```typescript copy showLineNumbers{8} filename="index.ts"
const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
});
```

## エージェントの設定 \{#agent-configuration\}

Mastra エージェントを、chain-of-thought のプロンプト手順に従って設定します。

```typescript copy showLineNumbers{14} filename="index.ts"
export const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions: `あなたは提供されたコンテキストに基づいて質問に答える有用なアシスタントです。
各回答について以下の手順に従ってください:

1. まず、取得したコンテキストチャンクを注意深く分析し、重要な情報を特定します。
2. 取得した情報がクエリとどのように関連しているかについて、思考プロセスを分解します。
3. 取得したチャンクから異なる情報をどのように結びつけているかを説明します。
4. 取得したコンテキストの証拠のみに基づいて結論を導き出します。
5. 取得したチャンクに十分な情報が含まれていない場合は、何が不足しているかを明示的に述べます。

回答を以下の形式でフォーマットしてください:
思考プロセス:
- ステップ1: [取得したチャンクの初期分析]
- ステップ2: [チャンク間の関連性]
- ステップ3: [チャンクに基づく推論]

最終回答:
[取得したコンテキストに基づく簡潔な回答]

重要: 質問に答えるよう求められた場合は、ツールで提供されたコンテキストのみに基づいて回答してください。
コンテキストに質問に完全に答えるための十分な情報が含まれていない場合は、それを明示的に述べてください。
注意: 結論に到達するために取得した情報をどのように使用しているかを説明してください。
`,
  model: openai('gpt-4o-mini'),
  tools: { vectorQueryTool },
});
```

## PgVector と Mastra のインスタンス化 \{#instantiate-pgvector-and-mastra\}

PgVector と Mastra を、すべてのコンポーネント込みでインスタンス化します:

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

ドキュメントを作成し、チャンクに分割して処理します：

```typescript copy showLineNumbers{44} filename="index.ts"
const doc = MDocument.fromText(`気候変動が世界の農業に与える影響...`);

const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 512,
  overlap: 50,
  separator: '\n',
});
```

## 埋め込みの作成と保存 \{#creating-and-storing-embeddings\}

チャンクの埋め込みを生成し、ベクトルデータベースに保存します。

```typescript copy showLineNumbers{55} filename="index.ts"
const { embeddings } = await embedMany({
  values: chunks.map(chunk => chunk.text),
  model: openai.embedding('text-embedding-3-small'),
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

## Chain-of-Thought クエリ \{#chain-of-thought-querying\}

エージェントがどのように推論を分解するかを確認するために、さまざまなクエリを試してみてください。

```typescript copy showLineNumbers{83} filename="index.ts"
const answerOne = await agent.generate('農業者にとっての主な適応策は何ですか？');
console.log('\nQuery:', '農業者にとっての主な適応策は何ですか？');
console.log('Response:', answerOne.text);

const answerTwo = await agent.generate('気温が作物収量に与える影響を分析してください。');
console.log('\nQuery:', '気温が作物収量に与える影響を分析してください。');
console.log('Response:', answerTwo.text);

const answerThree = await agent.generate('気候変動と食料安全保障にはどのような関係がありますか？');
console.log('\nQuery:', '気候変動と食料安全保障にはどのような関係がありますか？');
console.log('Response:', answerThree.text);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/cot-rag"
}
/>
