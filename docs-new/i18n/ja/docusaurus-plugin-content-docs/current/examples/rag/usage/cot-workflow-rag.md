---
title: "ワークフローで実現する構造化推論"
description: Mastra のワークフロー機能を使って、RAG システムに構造化推論を実装する例。
---

# ワークフローによる構造化推論 \{#structured-reasoning-with-workflows\}

この例では、Mastra、OpenAI の埋め込み、PGVector を用いたベクトルストレージを組み合わせて Retrieval-Augmented Generation（RAG）システムを実装する方法を、定義済みのワークフローによる構造化推論に重点を置いて示します。

## 概要 \{#overview\}

このシステムは、定義済みのワークフローを通じてチェーン・オブ・ソートのプロンプトを用い、Mastra と OpenAI による RAG を実装します。主な処理は次のとおりです。

1. 応答生成のために gpt-4o-mini を用いた Mastra エージェントをセットアップする
2. ベクターストアとのやり取りを管理するベクタークエリツールを作成する
3. チェーン・オブ・ソート推論のためのマルチステップのワークフローを定義する
4. テキストドキュメントを処理してチャンク化する
5. PostgreSQL に埋め込みベクトルを作成・保存する
6. ワークフローの各ステップを通じて応答を生成する

## セットアップ \{#setup\}

### 環境設定 \{#environment-setup\}

環境変数を設定してください。

```bash filename=".env"
OPENAI_API_KEY=your_openai_api_key_here
POSTGRES_CONNECTION_STRING=your_connection_string_here
```

### 依存関係 \{#dependencies\}

必要な依存物をインポートします:

```typescript copy showLineNumbers filename="index.ts"
import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Step, Workflow } from '@mastra/core/workflows';
import { PgVector } from '@mastra/pg';
import { createVectorQueryTool, MDocument } from '@mastra/rag';
import { embedMany } from 'ai';
import { z } from 'zod';
```

## ワークフローの定義 \{#workflow-definition\}

まず、トリガーのスキーマとともにワークフローを定義します:

```typescript copy showLineNumbers{10} filename="index.ts"
export const ragWorkflow = new Workflow({
  name: 'rag-workflow',
  triggerSchema: z.object({
    query: z.string(),
  }),
});
```

## ベクタークエリツールの作成 \{#vector-query-tool-creation\}

ベクターデータベースを検索するためのツールを作成します。

```typescript copy showLineNumbers{17} filename="index.ts"
const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
});
```

## エージェントの設定 \{#agent-configuration\}

Mastra エージェントをセットアップします：

```typescript copy showLineNumbers{23} filename="index.ts"
export const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions: `あなたは、与えられたコンテキストに基づいて質問に答える有用なアシスタントです。`,
  model: openai('gpt-4o-mini'),
  tools: {
    vectorQueryTool,
  },
});
```

## ワークフローの手順 \{#workflow-steps\}

このワークフローは、思考の連鎖を踏まえた推論のために、複数の手順に分けられています。

### 1. コンテキスト分析のステップ \{#1-context-analysis-step\}

```typescript copy showLineNumbers{32} filename="index.ts"
const analyzeContext = new Step({
  id: 'analyzeContext',
  outputSchema: z.object({
    initialAnalysis: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.getAgent('ragAgent');
    const query = context?.getStepResult<{ query: string }>('trigger')?.query;

    const analysisPrompt = `${query} 1. まず、取得したコンテキストチャンクを注意深く分析し、重要な情報を特定します。`;

    const analysis = await ragAgent?.generate(analysisPrompt);
    console.log(analysis?.text);
    return {
      initialAnalysis: analysis?.text ?? '',
    };
  },
});
```

### 2. 思考の分解ステップ \{#2-thought-breakdown-step\}

```typescript copy showLineNumbers{54} filename="index.ts"
const breakdownThoughts = new Step({
  id: 'breakdownThoughts',
  outputSchema: z.object({
    breakdown: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.getAgent('ragAgent');
    const analysis = context?.getStepResult<{
      initialAnalysis: string;
    }>('analyzeContext')?.initialAnalysis;

    const connectionPrompt = `
      初期分析に基づき: ${analysis}

      2. 取得した情報がクエリにどのように関係するかについて、思考の過程を分解して説明してください。
    `;

    const connectionAnalysis = await ragAgent?.generate(connectionPrompt);
    console.log(connectionAnalysis?.text);
    return {
      breakdown: connectionAnalysis?.text ?? '',
    };
  },
});
```

### 3. 接続手順 \{#3-connection-step\}

```typescript copy showLineNumbers{80} filename="index.ts"
const connectPieces = new Step({
  id: 'connectPieces',
  outputSchema: z.object({
    connections: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.getAgent('ragAgent');
    const process = context?.getStepResult<{
      breakdown: string;
    }>('breakdownThoughts')?.breakdown;
    const connectionPrompt = `
        内訳に基づいて: ${process}

        3. 取得したチャンクから得られた異なる要素をどのように関連付けているかを説明してください。
    `;

    const connections = await ragAgent?.generate(connectionPrompt);
    console.log(connections?.text);
    return {
      connections: connections?.text ?? '',
    };
  },
});
```

### 4. 結論のステップ \{#4-conclusion-step\}

```typescript copy showLineNumbers{105} filename="index.ts"
const drawConclusions = new Step({
  id: 'drawConclusions',
  outputSchema: z.object({
    conclusions: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.getAgent('ragAgent');
    const evidence = context?.getStepResult<{
      connections: string;
    }>('connectPieces')?.connections;
    const conclusionPrompt = `
        次の関連性に基づいて: ${evidence}

        4. 取得したコンテキスト内の証拠のみに基づいて結論を導いてください。
    `;

    const conclusions = await ragAgent?.generate(conclusionPrompt);
    console.log(conclusions?.text);
    return {
      conclusions: conclusions?.text ?? '',
    };
  },
});
```

### 5. 最終解答の手順 \{#5-final-answer-step\}

```typescript copy showLineNumbers{130} filename="index.ts"
const finalAnswer = new Step({
  id: 'finalAnswer',
  outputSchema: z.object({
    finalAnswer: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.getAgent('ragAgent');
    const conclusions = context?.getStepResult<{
      conclusions: string;
    }>('drawConclusions')?.conclusions;
    const answerPrompt = `
        次の結論に基づいて: ${conclusions}
        返答は以下の形式で記述してください:
        思考プロセス:
        - ステップ1: [取得したチャンクの初期分析]
        - ステップ2: [チャンク間の関連性]
        - ステップ3: [チャンクに基づく推論]

        最終回答:
        [取得した文脈に基づく簡潔な回答]

    const finalAnswer = await ragAgent?.generate(answerPrompt);
    console.log(finalAnswer?.text);
    return {
      finalAnswer: finalAnswer?.text ?? '',
    };
  },
});
```

## ワークフローの設定 \{#workflow-configuration\}

ワークフロー内のすべてのステップをつなぎます。

```typescript copy showLineNumbers{160} filename="index.ts"
ragWorkflow.step(analyzeContext).then(breakdownThoughts).then(connectPieces).then(drawConclusions).then(finalAnswer);

ragWorkflow.commit();
```

## PgVector と Mastra をインスタンス化する \{#instantiate-pgvector-and-mastra\}

すべてのコンポーネントを含めて、PgVector と Mastra をインスタンス化します:

```typescript copy showLineNumbers{169} filename="index.ts"
const pgVector = new PgVector({
  connectionString: process.env.POSTGRES_CONNECTION_STRING!,
});

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
  workflows: { ragWorkflow },
});
```

## ドキュメント処理 \{#document-processing\}

ドキュメントを処理し、チャンクに分割します:

```typescript copy showLineNumbers{177} filename="index.ts"
const doc = MDocument.fromText(`気候変動が世界の農業に与える影響…`);

const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 512,
  overlap: 50,
  separator: '\n',
});
```

## 埋め込みの作成と保存 \{#embedding-creation-and-storage\}

埋め込みを生成して保存します：

```typescript copy showLineNumbers{186} filename="index.ts"
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

## ワークフローの実行 \{#workflow-execution\}

クエリでワークフローを実行する方法は次のとおりです。

```typescript copy showLineNumbers{202} filename="index.ts"
const query = '農家の主な適応戦略は何ですか？';

console.log('\nクエリ:', query);
const prompt = `
    次の質問に回答してください:
    ${query}

    回答はツールで提供されたコンテキストのみに基づいて作成してください。コンテキストに質問へ完全に答えるのに十分な情報がない場合は、その旨を明確に述べてください。
    `;

const { runId, start } = await ragWorkflow.createRunAsync();

console.log('実行:', runId);

const workflowResult = await start({
  triggerData: {
    query: prompt,
  },
});
console.log('\n思考プロセス:');
console.log(workflowResult.results);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/cot-workflow-rag"
}
/>
