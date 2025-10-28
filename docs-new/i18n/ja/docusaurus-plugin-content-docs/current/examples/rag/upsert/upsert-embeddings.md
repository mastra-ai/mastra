---
title: "埋め込みのアップサート"
description: 類似検索のために、Mastra を用いてさまざまなベクトルデータベースに埋め込みを保存する例。
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# 埋め込みのアップサート \{#upsert-embeddings\}

埋め込みを生成したら、ベクトル類似検索に対応したデータベースに保存する必要があります。以下の例では、後で検索・取得できるよう、さまざまなベクトルデータベースに埋め込みを保存する方法を示します。

<Tabs>
  <TabItem value="pgvector" label="pgvector">
    `PgVector` クラスは、pgvector 拡張機能を使用して PostgreSQL にインデックスを作成し、埋め込みを挿入するためのメソッドを提供します。

    ```tsx copy
    import { openai } from "@ai-sdk/openai";
    import { PgVector } from "@mastra/pg";
    import { MDocument } from "@mastra/rag";
    import { embedMany } from "ai";

    const doc = MDocument.fromText("テキストコンテンツをここに記述...");

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map(chunk => chunk.text),
      model: openai.embedding("text-embedding-3-small"),
    });

    const pgVector = new PgVector({ connectionString: process.env.POSTGRES_CONNECTION_STRING! });

    await pgVector.createIndex({
      indexName: "test_index",
      dimension: 1536,
    });

    await pgVector.upsert({
      indexName: "test_index",
      vectors: embeddings,
      metadata: chunks?.map((chunk: any) => ({ text: chunk.text })),
    });
    ```

    <br />

    <hr className="dark:border-[#404040] border-gray-300" />

    <br />

    <GithubLink
      link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/insert-embedding-in-pgvector"
}
    />
  </TabItem>

  <TabItem value="松ぼっくり" label="Pinecone">
    `PineconeVector` クラスは、マネージド型のベクターデータベースサービスである Pinecone に対して、インデックスの作成や埋め込みの挿入を行うメソッドを提供します。

    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { PineconeVector } from '@mastra/pinecone';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('テキストコンテンツをここに入力...');

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map(chunk => chunk.text),
      model: openai.embedding('text-embedding-3-small'),
    });

    const pinecone = new PineconeVector({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    await pinecone.createIndex({
      indexName: 'testindex',
      dimension: 1536,
    });

    await pinecone.upsert({
      indexName: 'testindex',
      vectors: embeddings,
      metadata: chunks?.map(chunk => ({ text: chunk.text })),
    });
    ```

    <br />

    <hr className="dark:border-[#404040] border-gray-300" />

    <br />

    <GithubLink link={'https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/insert-embedding-in-pinecone'} />
  </TabItem>

  <TabItem value="Qdrant" label="Qdrant">
    `QdrantVector` クラスは、Qdrant（高性能なベクトルデータベース）にコレクションを作成したり埋め込みを挿入したりするためのメソッドを提供します。

    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { QdrantVector } from '@mastra/qdrant';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('テキストコンテンツをここに入力...');

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map(chunk => chunk.text),
      model: openai.embedding('text-embedding-3-small'),
      maxRetries: 3,
    });

    const qdrant = new QdrantVector({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });

    await qdrant.createIndex({
      indexName: 'test_collection',
      dimension: 1536,
    });

    await qdrant.upsert({
      indexName: 'test_collection',
      vectors: embeddings,
      metadata: chunks?.map(chunk => ({ text: chunk.text })),
    });
    ```
  </TabItem>

  <TabItem value="クロマ" label="クロマ">
    `ChromaVector` クラスは、オープンソースの埋め込みデータベースである Chroma に対してコレクションの作成や埋め込みの挿入を行うためのメソッドを提供します。

    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { ChromaVector } from '@mastra/chroma';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('テキストコンテンツを入力...');

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map(chunk => chunk.text),
      model: openai.embedding('text-embedding-3-small'),
    });

    // Chromaをローカルで実行する場合
    const store = new ChromaVector();

    // Chroma Cloudで実行する場合
    const store = new ChromaVector({
      apiKey: process.env.CHROMA_API_KEY,
      tenant: process.env.CHROMA_TENANT,
      database: process.env.CHROMA_DATABASE
    });

    await store.createIndex({
      indexName: 'test_collection',
      dimension: 1536,
    });

    await chroma.upsert({
      indexName: 'test_collection',
      vectors: embeddings,
      metadata: chunks.map(chunk => ({ text: chunk.text })),
      documents: chunks.map(chunk => chunk.text),
    });
    ```

    <br />

    <hr className="dark:border-[#404040] border-gray-300" />

    <br />

    <GithubLink link={'https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/insert-embedding-in-chroma'} />
  </TabItem>

  <TabItem value="astradb" label="Astra DB">
    `AstraVector` クラスは、コレクションの作成や埋め込みの DataStax Astra DB（クラウドネイティブなベクターデータベース）への挿入を行うためのメソッドを提供します。

    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { AstraVector } from '@mastra/astra';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('テキストコンテンツをここに入力...');

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: chunks.map(chunk => chunk.text),
    });

    const astra = new AstraVector({
      token: process.env.ASTRA_DB_TOKEN,
      endpoint: process.env.ASTRA_DB_ENDPOINT,
      keyspace: process.env.ASTRA_DB_KEYSPACE,
    });

    await astra.createIndex({
      indexName: 'test_collection',
      dimension: 1536,
    });

    await astra.upsert({
      indexName: 'test_collection',
      vectors: embeddings,
      metadata: chunks?.map(chunk => ({ text: chunk.text })),
    });
    ```
  </TabItem>

  <TabItem value="libsql" label="LibSQL">
    `LibSQLVector` クラスは、ベクター拡張を備えた SQLite のフォークである LibSQL に対して、コレクションの作成や埋め込みの挿入を行うためのメソッドを提供します。

    ```tsx copy
    import { openai } from "@ai-sdk/openai";
    import { LibSQLVector } from "@mastra/core/vector/libsql";
    import { MDocument } from "@mastra/rag";
    import { embedMany } from "ai";

    const doc = MDocument.fromText("テキストコンテンツを入力...");

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map((chunk) => chunk.text),
      model: openai.embedding("text-embedding-3-small"),
    });

    const libsql = new LibSQLVector({
      connectionUrl: process.env.DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN, // オプション: Tursoクラウドデータベース用
    });

    await libsql.createIndex({
      indexName: "test_collection",
      dimension: 1536,
    });

    await libsql.upsert({
      indexName: "test_collection",
      vectors: embeddings,
      metadata: chunks?.map((chunk) => ({ text: chunk.text })),
    });
    ```

    <br />

    <hr className="dark:border-[#404040] border-gray-300" />

    <br />

    <GithubLink link={'https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/insert-embedding-in-libsql'} />
  </TabItem>

  <TabItem value="Upstash" label="Upstash">
    `UpstashVector` クラスは、コレクションの作成や、サーバーレスのベクトルデータベースである Upstash Vector への埋め込みの挿入を行うメソッドを提供します。

    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { UpstashVector } from '@mastra/upstash';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('テキストコンテンツを入力...');

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map(chunk => chunk.text),
      model: openai.embedding('text-embedding-3-small'),
    });

    const upstash = new UpstashVector({
      url: process.env.UPSTASH_URL,
      token: process.env.UPSTASH_TOKEN,
    });

    // ここではstore.createIndexの呼び出しは不要です。Upstashはインデックス(Upstashではネームスペースと呼ばれます)を
    // upsert時にそのネームスペースが存在しない場合、自動的に作成します。
    await upstash.upsert({
      indexName: 'test_collection', // Upstashにおけるネームスペース名
      vectors: embeddings,
      metadata: chunks?.map(chunk => ({ text: chunk.text })),
    });
    ```
  </TabItem>

  <TabItem value="Cloudflare" label="Cloudflare">
    `CloudflareVector` クラスは、コレクションの作成や、サーバーレスのベクターデータベースサービスである Cloudflare Vectorize への埋め込みの挿入といった操作を行うメソッドを提供します。

    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { CloudflareVector } from '@mastra/vectorize';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('テキストコンテンツをここに入力...');

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map(chunk => chunk.text),
      model: openai.embedding('text-embedding-3-small'),
    });

    const vectorize = new CloudflareVector({
      accountId: process.env.CF_ACCOUNT_ID,
      apiToken: process.env.CF_API_TOKEN,
    });

    await vectorize.createIndex({
      indexName: 'test_collection',
      dimension: 1536,
    });

    await vectorize.upsert({
      indexName: 'test_collection',
      vectors: embeddings,
      metadata: chunks?.map(chunk => ({ text: chunk.text })),
    });
    ```
  </TabItem>

  <TabItem value="MongoDB" label="MongoDB">
    `MongoDBVector` クラスは、Atlas Search を用いて MongoDB にインデックスを作成し、埋め込みを挿入するメソッドを提供します。

    ```tsx copy
    import { openai } from "@ai-sdk/openai";
    import { MongoDBVector } from "@mastra/mongodb";
    import { MDocument } from "@mastra/rag";
    import { embedMany } from "ai";

    const doc = MDocument.fromText("テキストコンテンツをここに記述...");

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map(chunk => chunk.text),
      model: openai.embedding("text-embedding-3-small"),
    });

    const vectorDB = new MongoDBVector({
      uri: process.env.MONGODB_URI!,
      dbName: process.env.MONGODB_DB_NAME!,
    });

    await vectorDB.createIndex({
      indexName: "test_index",
      dimension: 1536,
    });

    await vectorDB.upsert({
      indexName: "test_index",
      vectors: embeddings,
      metadata: chunks?.map((chunk: any) => ({ text: chunk.text })),
    });
    ```
  </TabItem>

  <TabItem value="OpenSearch" label="OpenSearch">
    `OpenSearchVector` クラスは、ベクター検索機能を備えた分散検索エンジンである OpenSearch に、インデックスを作成し埋め込みを挿入するためのメソッドを提供します。

    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { OpenSearchVector } from '@mastra/opensearch';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('テキストコンテンツをここに入力...');

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map(chunk => chunk.text),
      model: openai.embedding('text-embedding-3-small'),
    });

    const vectorDB = new OpenSearchVector({
      uri: process.env.OPENSEARCH_URI!,
    });

    await vectorDB.createIndex({
      indexName: 'test_index',
      dimension: 1536,
    });

    await vectorDB.upsert({
      indexName: 'test_index',
      vectors: embeddings,
      metadata: chunks?.map((chunk: any) => ({ text: chunk.text })),
    });
    ```
  </TabItem>

  <TabItem value="couchbase" label="Couchbase">
    `CouchbaseVector` クラスは、ベクター検索機能を備えた分散型 NoSQL データベースである Couchbase に、インデックスを作成し埋め込みを挿入するためのメソッドを提供します。

    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { CouchbaseVector } from '@mastra/couchbase';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('テキストコンテンツをここに入力...');

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map(chunk => chunk.text),
      model: openai.embedding('text-embedding-3-small'),
    });

    const couchbase = new CouchbaseVector({
      connectionString: process.env.COUCHBASE_CONNECTION_STRING,
      username: process.env.COUCHBASE_USERNAME,
      password: process.env.COUCHBASE_PASSWORD,
      bucketName: process.env.COUCHBASE_BUCKET,
      scopeName: process.env.COUCHBASE_SCOPE,
      collectionName: process.env.COUCHBASE_COLLECTION,
    });

    await couchbase.createIndex({
      indexName: 'test_collection',
      dimension: 1536,
    });

    await couchbase.upsert({
      indexName: 'test_collection',
      vectors: embeddings,
      metadata: chunks?.map(chunk => ({ text: chunk.text })),
    });
    ```
  </TabItem>

  <TabItem value="lancedb" label="LanceDB">
    `LanceVectorStore` クラスは、Lance のカラムナー形式上に構築された組み込み型ベクターデータベースである LanceDB に対して、テーブルやインデックスの作成や、埋め込みの挿入を行うためのメソッドを提供します。

    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { LanceVectorStore } from '@mastra/lance';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('テキストコンテンツ...');

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map(chunk => chunk.text),
      model: openai.embedding('text-embedding-3-small'),
    });

    const lance = await LanceVectorStore.create('/path/to/db');

    // LanceDBでは最初にテーブルを作成する必要があります
    await lance.createIndex({
      tableName: 'myVectors',
      indexName: 'vector',
      dimension: 1536,
    });

    await lance.upsert({
      tableName: 'myVectors',
      vectors: embeddings,
      metadata: chunks?.map(chunk => ({ text: chunk.text })),
    });
    ```
  </TabItem>
</Tabs>