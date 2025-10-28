---
title: 取得
description: Mastra の RAG システムにおけるリトリーバル（セマンティック検索、フィルタリング、再ランキング）に関するガイド。
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## RAGシステムにおける取得（Retrieval） \{#retrieval-in-rag-systems\}

埋め込みを保存した後、ユーザーのクエリに回答するために、関連するチャンクを取得する必要があります。

Mastraは、セマンティック検索、フィルタリング、再ランキングに対応した柔軟なリトリーバルオプションを提供します。

## 検索の仕組み \{#how-retrieval-works\}

1. ユーザーのクエリは、ドキュメント埋め込みと同じモデルで埋め込みベクトルに変換される
2. このベクトルを、ベクトル類似度で保存済みの埋め込みと比較する
3. 最も類似するチャンクを取得し、必要に応じて次を実行できる:

* メタデータによるフィルタリング
* 関連性向上のための再ランク付け
* ナレッジグラフを用いた処理

## 基本的な検索 \{#basic-retrieval\}

最もシンプルな方法はセマンティック検索をそのまま使うことです。この方法では、ベクトル類似度を用いて、クエリと意味的に近いチャンクを見つけます。

```ts showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { PgVector } from '@mastra/pg';

// クエリを埋め込みに変換
const { embedding } = await embed({
  value: '記事の主なポイントは何ですか?',
  model: openai.embedding('text-embedding-3-small'),
});

// ベクトルストアに問い合わせ
const pgVector = new PgVector({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
});
const results = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 10,
});

// 結果を表示
console.log(results);
```

結果には、テキストの内容と類似度スコアの両方が含まれます。

```ts showLineNumbers copy
[
  {
    text: '気候変動は深刻な課題をもたらします...',
    score: 0.89,
    metadata: { source: 'article1.txt' },
  },
  {
    text: '気温上昇は作物の収穫量に影響を及ぼします...',
    score: 0.82,
    metadata: { source: 'article1.txt' },
  },
  // ... その他の結果
];
```

基本的な検索手法の使い方については、[Retrieve Results](/docs/examples/rag/query/retrieve-results) の例をご覧ください。

## 高度なリトリーバルオプション \{#advanced-retrieval-options\}

### メタデータのフィルタリング \{#metadata-filtering\}

メタデータフィールドに基づいて結果を絞り込み、検索対象を狭めます。これは、異なるソースや期間、特定の属性を持つドキュメントがある場合に有用です。Mastra は、すべての対応ベクターストアで動作する、統一された MongoDB 風のクエリ構文を提供します。

利用可能な演算子や構文の詳細は、[メタデータフィルターのリファレンス](/docs/reference/rag/metadata-filters)をご覧ください。

基本的なフィルタリングの例:

```ts showLineNumbers copy
// シンプルな等価フィルター
const results = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 10,
  filter: {
    source: 'article1.txt',
  },
});

// 数値比較
const results = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 10,
  filter: {
    price: { $gt: 100 },
  },
});

// 複数の条件
const results = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 10,
  filter: {
    category: 'electronics',
    price: { $lt: 1000 },
    inStock: true,
  },
});

// 配列操作
const results = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 10,
  filter: {
    tags: { $in: ['sale', 'new'] },
  },
});

// 論理演算子
const results = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 10,
  filter: {
    $or: [{ category: 'electronics' }, { category: 'accessories' }],
    $and: [{ price: { $gt: 50 } }, { price: { $lt: 200 } }],
  },
});
```

メタデータフィルタリングの一般的なユースケース：

* ドキュメントのソースまたは種類でフィルタリング
* 日付範囲でフィルタリング
* 特定のカテゴリーやタグでフィルタリング
* 数値範囲（例：価格、評価）でフィルタリング
* 複数の条件を組み合わせて精密に検索
* ドキュメントの属性（例：言語、著者）でフィルタリング

メタデータフィルタリングの使い方の例は、[Hybrid Vector Search](/docs/examples/rag/query/hybrid-vector-search) をご覧ください。

### ベクタークエリツール \{#vector-query-tool\}

エージェントにベクターデータベースへ直接クエリできる機能を持たせたい場合があります。ベクタークエリツールを使うと、エージェントが取得に関する判断を主導し、ユーザーのニーズに対する自身の理解に基づいて、セマンティック検索に任意のフィルタリングやリランキングを組み合わせられます。

```ts showLineNumbers copy
const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
});
```

ツールを作成する際は、ツール名と説明文に特に注意を払いましょう。これらは、エージェントがリトリーバル機能をいつ、どのように使うべきかを理解する助けになります。たとえば、名前を「SearchKnowledgeBase」、説明を「ドキュメントを横断検索して、Xというトピックに関する関連情報を見つけます」のようにできます。

これは次のような場合に特に有効です:

* エージェントが取得すべき情報を動的に判断する必要がある場合
* 取得プロセスに複雑な意思決定が伴う場合
* 文脈に応じて複数のリトリーバル戦略を組み合わせたい場合

#### データベース固有の設定 \{#database-specific-configurations\}

Vector Query Tool は、各ベクターストアの固有機能や最適化を活用できるように、データベース固有の設定をサポートしています。

```ts showLineNumbers copy
// 名前空間を使用したPinecone
const pineconeQueryTool = createVectorQueryTool({
  vectorStoreName: 'pinecone',
  indexName: 'docs',
  model: openai.embedding('text-embedding-3-small'),
  databaseConfig: {
    pinecone: {
      namespace: 'production', // 環境ごとにデータを分離
    },
  },
});

// パフォーマンスチューニングを行ったpgVector
const pgVectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'postgres',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
  databaseConfig: {
    pgvector: {
      minScore: 0.7, // 低品質な結果を除外
      ef: 200, // HNSW検索パラメータ
      probes: 10, // IVFFlat探索パラメータ
    },
  },
});

// 高度なフィルタリングを使用したChroma
const chromaQueryTool = createVectorQueryTool({
  vectorStoreName: 'chroma',
  indexName: 'documents',
  model: openai.embedding('text-embedding-3-small'),
  databaseConfig: {
    chroma: {
      where: { category: 'technical' },
      whereDocument: { $contains: 'API' },
    },
  },
});

// テーブル指定を使用したLanceDB
const lanceQueryTool = createVectorQueryTool({
  vectorStoreName: 'lance',
  indexName: 'documents',
  model: openai.embedding('text-embedding-3-small'),
  databaseConfig: {
    lance: {
      tableName: 'myVectors', // クエリ対象のテーブルを指定
      includeAllColumns: true, // 結果にすべてのメタデータ列を含める
    },
  },
});
```

**主な利点:**

* **Pinecone の namespace**: テナント・環境・データ種別ごとにベクターを整理
* **pgVector の最適化**: ef/probes パラメータで検索精度と速度を調整
* **品質フィルタリング**: 最小類似度のしきい値を設定して結果の関連性を向上
* **LanceDB のテーブル**: データをテーブルに分けて整理性とパフォーマンスを向上
* **実行時の柔軟性**: コンテキストに応じて設定を動的に上書き

**一般的なユースケース:**

* Pinecone の namespace を用いたマルチテナントアプリケーション
* 高負荷時のパフォーマンス最適化
* 環境別設定（dev/staging/prod）
* 品質基準での検索結果のゲーティング
* エッジ展開向け、LanceDB を用いた組み込み型のファイルベースベクターストレージ

これらの設定は、runtime context を使用して実行時に上書きすることも可能です:

```ts showLineNumbers copy
import { RuntimeContext } from '@mastra/core/runtime-context';

const runtimeContext = new RuntimeContext();
runtimeContext.set('databaseConfig', {
  pinecone: {
    namespace: 'runtime-namespace',
  },
});

await pineconeQueryTool.execute({
  context: { queryText: '検索クエリ' },
  mastra,
  runtimeContext,
});
```

詳細な設定オプションや高度な使い方については、[Vector Query Tool リファレンス](/docs/reference/tools/vector-query-tool)を参照してください。

### ベクターストアのプロンプト \{#vector-store-prompts\}

ベクターストアのプロンプトは、各ベクターデータベース実装におけるクエリパターンとフィルタリング機能を定義します。
フィルタリングを実装する際には、各ベクターストア実装で有効な演算子と構文を明示するために、これらのプロンプトをエージェントの指示に含める必要があります。

<Tabs>
  <TabItem value="pgvector" label="pgvector">
    ```ts showLineNumbers copy
    import { openai } from '@ai-sdk/openai';
    import { PGVECTOR_PROMPT } from '@mastra/pg';

    export const ragAgent = new Agent({
      name: 'RAGエージェント',
      model: openai('gpt-4o-mini'),
      instructions: `
      提供されたコンテキストを使用してクエリを処理します。簡潔で関連性の高い応答を構成します。
      ${PGVECTOR_PROMPT}
      `,
      tools: { vectorQueryTool },
    });
    ```
  </TabItem>

  <TabItem value="松ぼっくり" label="Pinecone">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { openai } from '@ai-sdk/openai';
    import { PINECONE_PROMPT } from "@mastra/pinecone";

    export const ragAgent = new Agent({
    name: 'RAGエージェント',
    model: openai('gpt-4o-mini'),
    instructions: `   提供されたコンテキストを使用してクエリを処理します。簡潔で関連性の高い応答を構成します。
      ${PINECONE_PROMPT}
      `,
    tools: { vectorQueryTool },
    });

    ```
  </TabItem>

  <TabItem value="qdrant" label="Qdrant">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { openai } from '@ai-sdk/openai';
    import { QDRANT_PROMPT } from "@mastra/qdrant";

    export const ragAgent = new Agent({
      name: 'RAGエージェント',
      model: openai('gpt-4o-mini'),
      instructions: `
      提供されたコンテキストを使用してクエリを処理します。簡潔で関連性の高い応答を構成してください。
      ${QDRANT_PROMPT}
      `,
      tools: { vectorQueryTool },
    });
    ```
  </TabItem>

  <TabItem value="彩度" label="Chroma">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { openai } from '@ai-sdk/openai';
    import { CHROMA_PROMPT } from "@mastra/chroma";

    export const ragAgent = new Agent({
    name: 'RAGエージェント',
    model: openai('gpt-4o-mini'),
    instructions: `   提供されたコンテキストを使用してクエリを処理します。簡潔で関連性の高い応答を構成してください。
      ${CHROMA_PROMPT}
      `,
    tools: { vectorQueryTool },
    });

    ```
  </TabItem>

  <TabItem value="astra" label="Astra">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { openai } from '@ai-sdk/openai';
    import { ASTRA_PROMPT } from "@mastra/astra";

    export const ragAgent = new Agent({
      name: 'RAGエージェント',
      model: openai('gpt-4o-mini'),
      instructions: `
      提供されたコンテキストを使用してクエリを処理します。簡潔で関連性の高い応答を構成してください。
      ${ASTRA_PROMPT}
      `,
      tools: { vectorQueryTool },
    });
    ```
  </TabItem>

  <TabItem value="libsql" label="LibSQL">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { openai } from '@ai-sdk/openai';
    import { LIBSQL_PROMPT } from "@mastra/libsql";

    export const ragAgent = new Agent({
    name: 'RAGエージェント',
    model: openai('gpt-4o-mini'),
    instructions: `   提供されたコンテキストを使用してクエリを処理します。簡潔で関連性の高い応答を構成します。
      ${LIBSQL_PROMPT}
      `,
    tools: { vectorQueryTool },
    });

    ```
  </TabItem>

  <TabItem value="Upstash" label="Upstash">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { openai } from '@ai-sdk/openai';
    import { UPSTASH_PROMPT } from "@mastra/upstash";

    export const ragAgent = new Agent({
      name: 'RAG エージェント',
      model: openai('gpt-4o-mini'),
      instructions: `
      提供されたコンテキストを使用してクエリを処理します。簡潔で関連性の高い応答を構成します。
      ${UPSTASH_PROMPT}
      `,
      tools: { vectorQueryTool },
    });
    ```
  </TabItem>

  <TabItem value="Cloudflare" label="Cloudflare">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { openai } from '@ai-sdk/openai';
    import { VECTORIZE_PROMPT } from "@mastra/vectorize";

    export const ragAgent = new Agent({
    name: 'RAGエージェント',
    model: openai('gpt-4o-mini'),
    instructions: `   提供されたコンテキストを使用してクエリを処理します。簡潔で関連性の高い応答を構成します。
      ${VECTORIZE_PROMPT}
      `,
    tools: { vectorQueryTool },
    });

    ```
  </TabItem>

  <TabItem value="MongoDB" label="MongoDB">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { openai } from '@ai-sdk/openai';
    import { MONGODB_PROMPT } from "@mastra/mongodb";

    export const ragAgent = new Agent({
      name: 'RAGエージェント',
      model: openai('gpt-4o-mini'),
      instructions: `
      提供されたコンテキストを使用してクエリを処理します。簡潔で関連性の高い応答を構成します。
      ${MONGODB_PROMPT}
      `,
      tools: { vectorQueryTool },
    });
    ```
  </TabItem>

  <TabItem value="OpenSearch" label="OpenSearch">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { openai } from '@ai-sdk/openai';
    import { OPENSEARCH_PROMPT } from "@mastra/opensearch";

    export const ragAgent = new Agent({
    name: 'RAGエージェント',
    model: openai('gpt-4o-mini'),
    instructions: `   提供されたコンテキストを使用してクエリを処理します。簡潔で関連性の高い応答を構成します。
      ${OPENSEARCH_PROMPT}
      `,
    tools: { vectorQueryTool },
    });

    ```
  </TabItem>

  <TabItem value="s3vectors" label="S3 ベクトル">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { openai } from '@ai-sdk/openai';
    import { S3VECTORS_PROMPT } from "@mastra/s3vectors";

    export const ragAgent = new Agent({
      name: 'RAGエージェント',
      model: openai('gpt-4o-mini'),
      instructions: `
      提供されたコンテキストを使用してクエリを処理します。簡潔で関連性の高い応答を構成してください。
      ${S3VECTORS_PROMPT}
      `,
      tools: { vectorQueryTool },
    });
    ```
  </TabItem>
</Tabs>

### リランキング \{#re-ranking\}

初期のベクター類似検索は、微妙な関連性を見落とすことがあります。リランキングは計算コストはかかるものの、より高精度なアルゴリズムで、次の点で結果を改善します:

* 語順や厳密な一致を考慮する
* より洗練された関連度スコアリングを適用する
* クエリとドキュメント間のクロスアテンションと呼ばれる手法を用いる

リランキングの使用方法は次のとおりです:

```ts showLineNumbers copy
import { openai } from "@ai-sdk/openai";
import {
  rerankWithScorer as rerank,
  MastraAgentRelevanceScorer
} from "@mastra/rag";

// ベクトル検索から初期結果を取得
const initialResults = await pgVector.query({
  indexName: "embeddings",
  queryVector: queryEmbedding,
  topK: 10,
});

// 関連性スコアラーを作成
const relevanceProvider = new MastraAgentRelevanceScorer('relevance-scorer', openai("gpt-4o-mini"));

// 結果を再ランク付け
const rerankedResults = await rerank({
  results: initialResults,
  query,
  provider: relevanceProvider,
  options: {
    topK: 10,
  },
);
```

> **注意:** 再ランキングでセマンティック・スコアリングを正しく機能させるには、各結果の `metadata.text` フィールドにテキスト内容を含める必要があります。

Cohere や ZeroEntropy などの他の関連度スコア提供元も使用できます。

```ts showLineNumbers copy
const relevanceProvider = new CohereRelevanceScorer('rerank-v3.5');
```

```ts showLineNumbers copy
const relevanceProvider = new ZeroEntropyRelevanceScorer('zerank-1');
```

再ランク付けされた結果は、ベクトル類似度と意味的な理解を組み合わせて、検索の精度を高めます。

再ランク付けの詳細は、[rerank()](/docs/reference/rag/rerankWithScorer) メソッドをご覧ください。

再ランク付けメソッドの使用例は、[Re-ranking Results](/docs/examples/rag/rerank) をご参照ください。

### グラフベースのリトリーバル \{#graph-based-retrieval\}

複雑な関連性を持つドキュメントでは、グラフベースのリトリーバルによりチャンク間のつながりをたどれます。これは次のような場合に有効です:

* 情報が複数のドキュメントにまたがっている
* ドキュメント同士が参照し合っている
* 完全な回答を得るために関係を辿る必要がある

セットアップ例:

```ts showLineNumbers copy
const graphQueryTool = createGraphQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
  graphOptions: {
    threshold: 0.7,
  },
});
```

グラフベースの検索について詳しくは、[GraphRAG](/docs/reference/rag/graph-rag) クラスと [createGraphQueryTool()](/docs/reference/tools/graph-rag-tool) 関数を参照してください。

グラフベースの検索手法の使い方については、[Graph-based Retrieval](/docs/examples/rag/usage/graph-rag) のサンプルをご覧ください。
