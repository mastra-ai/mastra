---
sidebar_position: 4
title: "RAG：リサーチアシスタント"
description: RAGを用いて学術論文を分析し、質問に回答するAIリサーチアシスタントの作成方法を解説します。
---

# RAG を用いた研究論文アシスタントの構築 \{#building-a-research-paper-assistant-with-rag\}

このガイドでは、学術論文を分析し、その内容に関する具体的な質問に Retrieval Augmented Generation（RAG）を用いて回答できる AI 研究アシスタントを作成します。

例として、基盤的な Transformer 論文[&quot;Attention Is All You Need&quot;](https://arxiv.org/html/1706.03762)を用います。データベースにはローカルの LibSQL を使用します。

## 前提条件 \{#prerequisites\}

* Node.js `v20.0` 以降がインストールされていること
* 対応する[モデルプロバイダー](/docs/models/providers)の API キー
* 既存の Mastra プロジェクト（新規プロジェクトのセットアップは[インストールガイド](/docs/getting-started/installation)を参照）

## RAG の仕組み \{#how-rag-works\}

RAG の働きと、各コンポーネントの実装方法を見ていきましょう。

### ナレッジストア／インデックス \{#knowledge-storeindex\}

* テキストをベクトル表現に変換する
* コンテンツを数値ベクトルとして表現する
* **実装**: OpenAI の `text-embedding-3-small` を使って埋め込みを生成し、LibSQLVector に保存します

### Retriever \{#retriever\}

* 類似検索によって関連するコンテンツを見つける
* クエリの埋め込みを保存済みベクトルとマッチングする
* **実装**: 保存された埋め込みに対して類似検索を行うために LibSQLVector を使用します

### ジェネレーター \{#generator\}

* 取得したコンテンツを LLM で処理する
* 文脈に沿った応答を生成する
* **実装**: 取得コンテンツに基づいて回答を生成するために GPT-4o-mini を使用する

この実装では次を行います:

1. Transformer 論文を埋め込みベクトルに変換する
2. 高速な取得のために LibSQLVector に保存する
3. 類似度検索で関連セクションを特定する
4. 取得したコンテキストを用いて正確な応答を生成する

## エージェントの作成 \{#creating-the-agent\}

エージェントの挙動を定義し、Mastra プロジェクトに接続して、ベクター ストアを作成しましょう。

### 追加の依存関係をインストールする \{#install-additional-dependencies\}

[インストールガイド](/docs/getting-started/installation) を実施した後、追加の依存関係をインストールする必要があります：

```bash copy
npm install @mastra/rag@latest ai@^4.0.0
```

:::note バージョン互換性

Mastra は現在、AI SDK の v5 をサポートしていません（[サポートスレッド](https://github.com/mastra-ai/mastra/issues/5470)を参照）。このガイドでは v4 を使用してください。

:::

### エージェントを定義する \{#define-the-agent\}

これから、RAG 対応のリサーチアシスタントを作成します。エージェントは次を使用します:

* 論文から関連する内容を見つけるために、ベクターストア上でセマンティック検索を行う [Vector Query Tool](/docs/reference/tools/vector-query-tool)
* クエリの理解と応答の生成を行う GPT-4o-mini
* 論文の分析方法、取得したコンテンツの効果的な活用方法、制約の明示の仕方を指示するカスタムインストラクション

新しいファイル `src/mastra/agents/researchAgent.ts` を作成し、エージェントを定義します:

```ts copy filename="src/mastra/agents/researchAgent.ts"
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { createVectorQueryTool } from '@mastra/rag';

// 論文の埋め込みに対してセマンティック検索を行うツールを作成する
const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'libSqlVector',
  indexName: 'papers',
  model: openai.embedding('text-embedding-3-small'),
});

export const researchAgent = new Agent({
  name: 'リサーチアシスタント',
  instructions: `あなたは学術論文や技術文書を分析する、有能で役に立つリサーチアシスタントです。
    提供されたベクトル検索ツールを用いてナレッジベースから関連情報を見つけ、
    取得したコンテンツに基づき、正確で根拠のある回答を行ってください。
    ツールで参照可能な具体的な内容に焦点を当て、質問に答えるのに十分な情報が見つからない場合はその旨を明確に述べてください。
    回答は一般的な知識ではなく、提供されたコンテンツのみに基づいてください。`,
  model: openai('gpt-4o-mini'),
  tools: {
    vectorQueryTool,
  },
});
```

### ベクターストアを作成する \{#create-the-vector-store\}

プロジェクトのルートで `pwd` コマンドを実行して、絶対パスを取得します。パスは次のようになる場合があります：

```bash
> pwd
/Users/your-name/guides/research-assistant
```

`src/mastra/index.ts` ファイルの既存の内容と設定に、次のコードを追加してください:

```ts copy filename="src/mastra/index.ts" {2, 4-6, 9}
import { Mastra } from '@mastra/core/mastra';
import { LibSQLVector } from '@mastra/libsql';

const libSqlVector = new LibSQLVector({
  connectionUrl: 'file:/Users/your-name/guides/research-assistant/vector.db',
});

export const mastra = new Mastra({
  vectors: { libSqlVector },
});
```

`connectionUrl` には、`pwd` コマンドで取得した絶対パスを指定してください。こうすると、`vector.db` ファイルはプロジェクトのルートに作成されます。

:::note

このガイドでは説明のためにローカルの LibSQL ファイルを指す絶対パスをハードコードしていますが、本番環境ではこの方法は使えません。代わりにリモートの永続的なデータベースを使用してください。

:::

### エージェントを Mastra に登録する \{#register-the-agent-with-mastra\}

`src/mastra/index.ts` ファイルで、エージェントを Mastra に登録します:

```ts copy filename="src/mastra/index.ts" {3, 10}
import { Mastra } from '@mastra/core/mastra';
import { LibSQLVector } from '@mastra/libsql';
import { researchAgent } from './agents/researchAgent';

const libSqlVector = new LibSQLVector({
  connectionUrl: 'file:/Users/your-name/guides/research-assistant/vector.db',
});

export const mastra = new Mastra({
  agents: { researchAgent },
  vectors: { libSqlVector },
});
```

## ドキュメントの処理 \{#processing-documents\}

次の手順では、研究論文を取得し、小さな単位に分割してそれぞれに埋め込みを生成し、これらの情報をベクターデータベースに保存します。

### 論文を読み込み、処理する \{#load-and-process-the-paper\}

このステップでは、URL を指定して論文を取得し、ドキュメントオブジェクトに変換したうえで、扱いやすい小さなチャンクに分割します。チャンクに分割することで、処理がより高速かつ効率的になります。

新しいファイル `src/store.ts` を作成し、次を追加します:

```ts copy filename="src/store.ts"
import { MDocument } from '@mastra/rag';

// 論文を取得する
const paperUrl = 'https://arxiv.org/html/1706.03762';
const response = await fetch(paperUrl);
const paperText = await response.text();

// ドキュメントを作成してチャンク化する
const doc = MDocument.fromText(paperText);
const chunks = await doc.chunk({
  strategy: 'recursive',
  maxSize: 512,
  overlap: 50,
  separators: ['\n\n', '\n', ' '],
});

console.log('チャンク数:', chunks.length);
```

ターミナルでファイルを実行してください：

```bash copy
npx bun src/store.ts を実行する
```

次のような応答が返ってくるはずです：

```bash
チャンク数：892
```

### 埋め込みを作成して保存する \{#create-and-store-embeddings\}

最後に、RAG 用にコンテンツを次のように準備します:

1. 各テキストチャンクの埋め込みを生成する
2. 埋め込みを保持するベクトルストアのインデックスを作成する
3. 埋め込みとメタデータ（元のテキストとソース情報）の両方をベクトルデータベースに保存する

:::note

このメタデータは、ベクトルストアが関連する一致を見つけた際に
実際のコンテンツを返せるようにするために不可欠です。

:::

これにより、エージェントは関連情報を効率的に検索・取得できます。

`src/store.ts` ファイルを開き、次を追加します:

```ts copy filename="src/store.ts" {2-4, 20-99}
import { MDocument } from '@mastra/rag';
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import { mastra } from './mastra';

// 論文を読み込む
const paperUrl = 'https://arxiv.org/html/1706.03762';
const response = await fetch(paperUrl);
const paperText = await response.text();

// ドキュメントを作成してチャンクに分割する
const doc = MDocument.fromText(paperText);
const chunks = await doc.chunk({
  strategy: 'recursive',
  maxSize: 512,
  overlap: 50,
  separators: ['\n\n', '\n', ' '],
});

// 埋め込みを生成する
const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

// Mastra からベクターストアのインスタンスを取得する
const vectorStore = mastra.getVector('libSqlVector');

// 論文のチャンク用インデックスを作成する
await vectorStore.createIndex({
  indexName: 'papers',
  dimension: 1536,
});

// 埋め込みを保存する
await vectorStore.upsert({
  indexName: 'papers',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({
    text: chunk.text,
    source: 'transformer-paper',
  })),
});
```

最後に、スクリプトをもう一度実行して、埋め込みを保存します。

```bash copy
npx bun src/store.ts
```

操作が成功していれば、ターミナルには出力もエラーも表示されません。

## アシスタントをテストする \{#test-the-assistant\}

ベクターデータベースにすべての埋め込みが作成されたので、さまざまな種類のクエリでリサーチアシスタントをテストできます。

新しいファイル `src/ask-agent.ts` を作成し、いくつかの種類のクエリを追加します:

```ts filename="src/ask-agent.ts" copy
import { mastra } from './mastra';
const agent = mastra.getAgent('researchAgent');

// 概念に関する基本的な問い合わせ
const query1 = 'ニューラルネットワークにおける系列モデリングはどのような課題に直面していますか？';
const response1 = await agent.generate(query1);
console.log('\n問い合わせ:', query1);
console.log('回答:', response1.text);
```

スクリプトを実行する:

```bash copy
npx bun src/ask-agent.ts
```

次のような出力が表示されます:

```bash
Query: ニューラルネットワークを用いた系列モデリングはどのような問題に直面しますか？
Response: ニューラルネットワークを用いた系列モデリングには、次のような主要な課題があります。
1. 特に長い系列で学習時に生じる勾配消失・勾配爆発
2. 入力の長期依存関係を扱うことの難しさ
3. 逐次処理による計算効率の低さ
4. 計算を並列化しにくく、学習時間が長くなること
```

別の質問を試してみてください：

```ts filename="src/ask-agent.ts" copy
import { mastra } from './mastra';
const agent = mastra.getAgent('researchAgent');

// 特定の知見に関する問い合わせ
const query2 = '翻訳品質にはどのような改善が見られましたか？';
const response2 = await agent.generate(query2);
console.log('\nクエリ:', query2);
console.log('応答:', response2.text);
```

出力：

```
Query: 翻訳品質にはどのような改善が見られましたか？
Response: このモデルは翻訳品質が大幅に向上し、
WMT 2014の英独翻訳タスクで、従来報告されているモデルに対してBLEUスコアで2.0ポイント超の改善を達成し、
同時に学習コストも削減しました。
```

### アプリケーションを提供する \{#serve-the-application\}

Mastra サーバーを起動して、API 経由でリサーチアシスタントを公開します：

```bash
mastra dev
```

リサーチアシスタントは次の場所で利用できます：

```
http://localhost:4111/api/agents/researchAgent/generate
```

curl でテストする：

```bash
curl -X POST http://localhost:4111/api/agents/researchAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "モデルの並列化に関する主な知見は何でしたか？" }
    ]
  }'
```

## 高度な RAG の例 \{#advanced-rag-examples\}

より高度な RAG 手法の例をご覧ください:

* メタデータを使って結果をフィルタリングするための [Filter RAG](/docs/examples/rag/usage/filter-rag)
* 情報密度を最適化するための [Cleanup RAG](/docs/examples/rag/usage/cleanup-rag)
* ワークフローを用いて複雑な推論クエリに対応するための [Chain of Thought RAG](/docs/examples/rag/usage/cot-rag)
* 結果の関連性を高めるための [Rerank RAG](/docs/examples/rag/rerank/rerank-rag)