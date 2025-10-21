---
title: 'Upsert Embeddings '
description: Examples of using Mastra to store embeddings in various vector databases for similarity search.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Upsert Embeddings

After generating embeddings, you need to store them in a database that supports vector similarity search. This example shows how to store embeddings in various vector databases for later retrieval.

<Tabs>
['PgVector', 'Pinecone', 'Qdrant', 'Chroma', 'Astra DB', 'LibSQL', 'Upstash', 'Cloudflare', 'MongoDB', 'OpenSearch', 'Couchbase', 'LanceDB']}>
  <TabItem value="the-pgvector-class-provides-methods-to-create-ind" label="The `PgVector` class provides methods to create ind">
  The `PgVector` class provides methods to create indexes and insert embeddings into PostgreSQL with the pgvector extension.
    ```tsx copy
    import { openai } from "@ai-sdk/openai";
    import { PgVector } from "@mastra/pg";
    import { MDocument } from "@mastra/rag";
    import { embedMany } from "ai";

    const doc = MDocument.fromText("Your text content...");

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

  <TabItem value="the-pineconevector-class-provides-methods-to-crea" label="The `PineconeVector` class provides methods to crea">
  The `PineconeVector` class provides methods to create indexes and insert embeddings into Pinecone, a managed vector database service.
    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { PineconeVector } from '@mastra/pinecone';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('Your text content...');

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
    <GithubLink
      link={'https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/insert-embedding-in-pinecone'}
    />

  </TabItem>

  <TabItem value="the-qdrantvector-class-provides-methods-to-create" label="The `QdrantVector` class provides methods to create">
  The `QdrantVector` class provides methods to create collections and insert embeddings into Qdrant, a high-performance vector database.
    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { QdrantVector } from '@mastra/qdrant';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('Your text content...');

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

  <TabItem value="the-chromavector-class-provides-methods-to-create" label="The `ChromaVector` class provides methods to create">
  The `ChromaVector` class provides methods to create collections and insert embeddings into Chroma, an open-source embedding database.
    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { ChromaVector } from '@mastra/chroma';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('Your text content...');

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map(chunk => chunk.text),
      model: openai.embedding('text-embedding-3-small'),
    });

    // Running Chroma locally
    const store = new ChromaVector();

    // Running on Chroma Cloud
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
    <GithubLink
      link={'https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/insert-embedding-in-chroma'}
    />

  </TabItem>

  <TabItem value="create" label="create">
  he `AstraVector` class provides methods to create collections and insert embeddings into DataStax Astra DB, a cloud-native vector database.
    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { AstraVector } from '@mastra/astra';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('Your text content...');

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

  <TabItem value="the-libsqlvector-class-provides-methods-to-create" label="The `LibSQLVector` class provides methods to create">
  The `LibSQLVector` class provides methods to create collections and insert embeddings into LibSQL, a fork of SQLite with vector extensions.
    ```tsx copy
    import { openai } from "@ai-sdk/openai";
    import { LibSQLVector } from "@mastra/core/vector/libsql";
    import { MDocument } from "@mastra/rag";
    import { embedMany } from "ai";

    const doc = MDocument.fromText("Your text content...");

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map((chunk) => chunk.text),
      model: openai.embedding("text-embedding-3-small"),
    });

    const libsql = new LibSQLVector({
      connectionUrl: process.env.DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN, // Optional: for Turso cloud databases
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
    <GithubLink
      link={'https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/insert-embedding-in-libsql'}
    />

  </TabItem>

  <TabItem value="the-upstashvector-class-provides-methods-to-creat" label="The `UpstashVector` class provides methods to creat">
  The `UpstashVector` class provides methods to create collections and insert embeddings into Upstash Vector, a serverless vector database.
    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { UpstashVector } from '@mastra/upstash';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('Your text content...');

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map(chunk => chunk.text),
      model: openai.embedding('text-embedding-3-small'),
    });

    const upstash = new UpstashVector({
      url: process.env.UPSTASH_URL,
      token: process.env.UPSTASH_TOKEN,
    });

    // There is no store.createIndex call here, Upstash creates indexes (known as namespaces in Upstash) automatically
    // when you upsert if that namespace does not exist yet.
    await upstash.upsert({
      indexName: 'test_collection', // the namespace name in Upstash
      vectors: embeddings,
      metadata: chunks?.map(chunk => ({ text: chunk.text })),
    });
    ```

  </TabItem>

  <TabItem value="the-cloudflarevector-class-provides-methods-to-cr" label="The `CloudflareVector` class provides methods to cr">
  The `CloudflareVector` class provides methods to create collections and insert embeddings into Cloudflare Vectorize, a serverless vector database service.
    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { CloudflareVector } from '@mastra/vectorize';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('Your text content...');

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
  <TabItem value="the-mongodbvector-class-provides-methods-to-creat" label="The `MongoDBVector` class provides methods to creat">
  The `MongoDBVector` class provides methods to create indexes and insert embeddings into MongoDB with Atlas Search.
    ```tsx copy
    import { openai } from "@ai-sdk/openai";
    import { MongoDBVector } from "@mastra/mongodb";
    import { MDocument } from "@mastra/rag";
    import { embedMany } from "ai";

    const doc = MDocument.fromText("Your text content...");

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

  <TabItem value="the-opensearchvector-class-provides-methods-to-cr" label="The `OpenSearchVector` class provides methods to cr">
  The `OpenSearchVector` class provides methods to create indexes and insert embeddings into OpenSearch, a distributed search engine with vector search capabilities.
    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { OpenSearchVector } from '@mastra/opensearch';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('Your text content...');

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

  <TabItem value="the-couchbasevector-class-provides-methods-to-cre" label="The `CouchbaseVector` class provides methods to cre">
  The `CouchbaseVector` class provides methods to create indexes and insert embeddings into Couchbase, a distributed NoSQL database with vector search capabilities.
    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { CouchbaseVector } from '@mastra/couchbase';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('Your text content...');

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

  <TabItem value="the-lancevectorstore-class-provides-methods-to-cr" label="The `LanceVectorStore` class provides methods to cr">
  The `LanceVectorStore` class provides methods to create tables, indexes and insert embeddings into LanceDB, an embedded vector database built on the Lance columnar format.
    ```tsx copy
    import { openai } from '@ai-sdk/openai';
    import { LanceVectorStore } from '@mastra/lance';
    import { MDocument } from '@mastra/rag';
    import { embedMany } from 'ai';

    const doc = MDocument.fromText('Your text content...');

    const chunks = await doc.chunk();

    const { embeddings } = await embedMany({
      values: chunks.map(chunk => chunk.text),
      model: openai.embedding('text-embedding-3-small'),
    });

    const lance = await LanceVectorStore.create('/path/to/db');

    // In LanceDB you need to create a table first
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
