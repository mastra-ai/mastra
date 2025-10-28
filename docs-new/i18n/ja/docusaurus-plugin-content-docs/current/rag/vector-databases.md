---
title: ベクターデータベース
description: Mastra におけるベクターストレージの選択肢を解説します。類似検索向けの埋め込み型および専用のベクターデータベースについて紹介します。
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## ベクターデータベースへの埋め込みの保存 \{#storing-embeddings-in-a-vector-database\}

埋め込みを生成したら、ベクトル類似検索をサポートするデータベースに保存する必要があります。Mastra は、さまざまなベクターデータベースに対して、埋め込みの保存と検索を行うための統一的なインターフェースを提供します。

## 対応データベース \{#supported-databases\}

<Tabs>
  <TabItem value="MongoDB" label="MongoDB">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { MongoDBVector } from '@mastra/mongodb'

    const store = new MongoDBVector({
      uri: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DATABASE
    })
    await store.createIndex({
      indexName: "myCollection",
      dimension: 1536,
    });
    await store.upsert({
      indexName: "myCollection",
      vectors: embeddings,
      metadata: chunks.map(chunk => ({ text: chunk.text })),
    });

    ```

    ### MongoDB Atlas Vector Search の利用 \{#using-mongodb-atlas-vector-search\}

    詳細なセットアップ手順やベストプラクティスについては、[MongoDB Atlas Vector Search の公式ドキュメント](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-overview/?utm_campaign=devrel\&utm_source=third-party-content\&utm_medium=cta\&utm_content=mastra-docs)をご覧ください。
  </TabItem>

  <TabItem value="pgvector" label="Pgvector">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { PgVector } from '@mastra/pg';

    const store = new PgVector({ connectionString: process.env.POSTGRES_CONNECTION_STRING })

    await store.createIndex({
    indexName: "myCollection",
    dimension: 1536,
    });

    await store.upsert({
    indexName: "myCollection",
    vectors: embeddings,
    metadata: chunks.map(chunk => ({ text: chunk.text })),
    });

    ```

    ### pgvector と併用する PostgreSQL \{#using-postgresql-with-pgvector\}

    pgvector 拡張を使った PostgreSQL は、すでに PostgreSQL を利用しており、インフラの複雑さを抑えたいチームにとって適切な選択肢です。
    詳細なセットアップ手順やベストプラクティスは、[公式 pgvector リポジトリ](https://github.com/pgvector/pgvector)を参照してください。
  </TabItem>

  <TabItem value="松ぼっくり" label="Pinecone">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { PineconeVector } from '@mastra/pinecone'

    const store = new PineconeVector({
      apiKey: process.env.PINECONE_API_KEY,
    })
    await store.createIndex({
      indexName: "myCollection",
      dimension: 1536,
    });
    await store.upsert({
      indexName: "myCollection",
      vectors: embeddings,
      metadata: chunks.map(chunk => ({ text: chunk.text })),
    });
    ```
  </TabItem>

  <TabItem value="Qdrant" label="Qdrant">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { QdrantVector } from '@mastra/qdrant'

    const store = new QdrantVector({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY
    })

    await store.createIndex({
    indexName: "myCollection",
    dimension: 1536,
    });

    await store.upsert({
    indexName: "myCollection",
    vectors: embeddings,
    metadata: chunks.map(chunk => ({ text: chunk.text })),
    });

    ```
  </TabItem>

  <TabItem value="彩度" label="クロマ">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { ChromaVector } from '@mastra/chroma'

    // Chroma をローカルで実行する
    // const store = new ChromaVector()

    // Chroma Cloud 上で実行する
    const store = new ChromaVector({
      apiKey: process.env.CHROMA_API_KEY,
      tenant: process.env.CHROMA_TENANT,
      database: process.env.CHROMA_DATABASE
    })

    await store.createIndex({
      indexName: "myCollection",
      dimension: 1536,
    });

    await store.upsert({
      indexName: "myCollection",
      vectors: embeddings,
      metadata: chunks.map(chunk => ({ text: chunk.text })),
    });
    ```
  </TabItem>

  <TabItem value="アストラ" label="Astra">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { AstraVector } from '@mastra/astra'

    const store = new AstraVector({
    token: process.env.ASTRA_DB_TOKEN,
    endpoint: process.env.ASTRA_DB_ENDPOINT,
    keyspace: process.env.ASTRA_DB_KEYSPACE
    })

    await store.createIndex({
    indexName: "myCollection",
    dimension: 1536,
    });

    await store.upsert({
    indexName: "myCollection",
    vectors: embeddings,
    metadata: chunks.map(chunk => ({ text: chunk.text })),
    });

    ```
  </TabItem>

  <TabItem value="libsql" label="LibSQL">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { LibSQLVector } from "@mastra/core/vector/libsql";

    const store = new LibSQLVector({
      connectionUrl: process.env.DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN // 任意（Turso のクラウドデータベース用）
    })

    await store.createIndex({
      indexName: "myCollection",
      dimension: 1536,
    });

    await store.upsert({
      indexName: "myCollection",
      vectors: embeddings,
      metadata: chunks.map(chunk => ({ text: chunk.text })),
    });
    ```
  </TabItem>

  <TabItem value="Upstash" label="Upstash">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { UpstashVector } from '@mastra/upstash'

    // Upstashではストアをインデックスと呼びます
    const store = new UpstashVector({
    url: process.env.UPSTASH_URL,
    token: process.env.UPSTASH_TOKEN
    })

    // ここではstore.createIndexの呼び出しはありません。Upstashでは、upsert時に名前空間が存在しない場合、インデックス(Upstashでは名前空間と呼ばれます)が自動的に作成されます
    // その名前空間がまだ存在しない場合に自動作成されます
    await store.upsert({
    indexName: "myCollection", // Upstashにおける名前空間名
    vectors: embeddings,
    metadata: chunks.map(chunk => ({ text: chunk.text })),
    });

    ```
  </TabItem>

  <TabItem value="Cloudflare" label="Cloudflare">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { CloudflareVector } from '@mastra/vectorize'

    const store = new CloudflareVector({
      accountId: process.env.CF_ACCOUNT_ID,
      apiToken: process.env.CF_API_TOKEN
    })
    await store.createIndex({
      indexName: "myCollection",
      dimension: 1536,
    });
    await store.upsert({
      indexName: "myCollection",
      vectors: embeddings,
      metadata: chunks.map(chunk => ({ text: chunk.text })),
    });
    ```
  </TabItem>

  <TabItem value="OpenSearch" label="OpenSearch">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { OpenSearchVector } from '@mastra/opensearch'

    const store = new OpenSearchVector({ url: process.env.OPENSEARCH_URL })

    await store.createIndex({
    indexName: "my-collection",
    dimension: 1536,
    });

    await store.upsert({
    indexName: "my-collection",
    vectors: embeddings,
    metadata: chunks.map(chunk => ({ text: chunk.text })),
    });

    ```
  </TabItem>

  <TabItem value="Couchbase" label="Couchbase">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { CouchbaseVector } from '@mastra/couchbase'

    const store = new CouchbaseVector({
      connectionString: process.env.COUCHBASE_CONNECTION_STRING,
      username: process.env.COUCHBASE_USERNAME,
      password: process.env.COUCHBASE_PASSWORD,
      bucketName: process.env.COUCHBASE_BUCKET,
      scopeName: process.env.COUCHBASE_SCOPE,
      collectionName: process.env.COUCHBASE_COLLECTION,
    })
    await store.createIndex({
      indexName: "myCollection",
      dimension: 1536,
    });
    await store.upsert({
      indexName: "myCollection",
      vectors: embeddings,
      metadata: chunks.map(chunk => ({ text: chunk.text })),
    });
    ```
  </TabItem>

  <TabItem value="lancedb-の使い方" label="LanceDB">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { LanceVectorStore } from '@mastra/lance'

    const store = await LanceVectorStore.create('/path/to/db')

    await store.createIndex({
    tableName: "myVectors",
    indexName: "myCollection",
    dimension: 1536,
    });

    await store.upsert({
    tableName: "myVectors",
    vectors: embeddings,
    metadata: chunks.map(chunk => ({ text: chunk.text })),
    });

    ```

    ### LanceDB の利用 \{#using-lancedb\}

    LanceDB は Lance 列指向フォーマット上に構築された組み込み型ベクターデータベースで、ローカル開発やクラウドへのデプロイに適しています。
    詳細なセットアップ手順やベストプラクティスについては、[LanceDB の公式ドキュメント](https://lancedb.github.io/lancedb/)をご覧ください。
  </TabItem>

  <TabItem value="s3vectors" label="S3 ベクトル">
    ```ts filename="vector-store.ts" showLineNumbers copy
    import { S3Vectors } from "@mastra/s3vectors";

    const store = new S3Vectors({
    vectorBucketName: "my-vector-bucket",
    clientConfig: {
      region: "us-east-1",
    },
    nonFilterableMetadataKeys: ["content"],
    });

    await store.createIndex({
    indexName: "my-index",
    dimension: 1536,
    });
    await store.upsert({
    indexName: "my-index",
    vectors: embeddings,
    metadata: chunks.map(chunk => ({ text: chunk.text })),
    });
    ```
  </TabItem>
</Tabs>

## ベクターストレージの使用 \{#using-vector-storage\}

初期化が完了すると、すべてのベクターストアで、インデックスの作成、埋め込みのアップサート、クエリが同一のインターフェースで利用できます。

### インデックスの作成 \{#creating-indexes\}

埋め込みを保存する前に、使用する埋め込みモデルに合った次元数でインデックスを作成する必要があります。

```ts filename="store-embeddings.ts" showLineNumbers copy
// 次元数 1536 のインデックスを作成（text-embedding-3-small 用）
await store.createIndex({
  indexName: 'myCollection',
  dimension: 1536,
});
```

選択した埋め込みモデルの出力次元に、次元サイズを合わせる必要があります。一般的な次元サイズは次のとおりです:

* OpenAI text-embedding-3-small: 1536次元（またはカスタム例: 256）
* Cohere embed-multilingual-v3: 1024次元
* Google `text-embedding-004`: 768次元（またはカスタム）

> **重要**: インデックスの次元数は作成後に変更できません。別のモデルを使用する場合は、インデックスを削除し、新しい次元サイズで再作成してください。

### データベースの命名規則 \{#naming-rules-for-databases\}

各ベクターデータベースは、互換性の確保と競合の防止のため、インデックスやコレクションに特定の命名規則を設けています。

<Tabs>
  <TabItem value="MongoDB の命名" label="MongoDB">
    コレクション（インデックス）名は次の条件を満たす必要があります:

    * 文字またはアンダースコアで始まること
    * 最大120バイトであること
    * 文字、数字、アンダースコア、またはドットのみを含むこと
    * `$` またはヌル文字を含まないこと
    * 例: `my_collection.123` は有効
    * 例: `my-index` は無効（ハイフンを含む）
    * 例: `My$Collection` は無効（`$` を含む）
  </TabItem>

  <TabItem value="pgvector-naming" label="pgvector">
    インデックス名は次の条件を満たす必要があります:

    * 文字またはアンダースコアで始まること
    * 文字、数字、アンダースコアのみを含むこと
    * 例: `my_index_123` は有効
    * 例: `my-index` は無効（ハイフンを含むため）
  </TabItem>

  <TabItem value="pinecone-naming" label="Pinecone">
    Index 名は次を満たす必要があります:

    * 小文字の英字、数字、ダッシュのみを使用すること
    * ドットを含めないこと（DNS ルーティングで使用されるため）
    * ラテン文字以外や絵文字を使用しないこと
    * プロジェクト ID を含めた合計の長さを 52 文字未満にすること
      * 例: `my-index-123` は有効
      * 例: `my.index` は無効（ドットを含む）
  </TabItem>

  <TabItem value="qdrant-naming" label="Qdrant">
    コレクション名は次の条件を満たす必要があります:

    * 1～255文字であること
    * 次の特殊文字を含まないこと:
      * `< > : " / \ | ? *`
      * Null 文字（`\0`）
      * ユニットセパレータ（`\u{1F}`）
    * 例: `my_collection_123` は有効
    * 例: `my/collection` は無効（スラッシュを含むため）
  </TabItem>

  <TabItem value="chroma の命名規則" label="クロマ">
    コレクション名は次の条件を満たす必要があります:

    * 3〜63文字であること
    * 文字または数字で始まり、文字または数字で終わること
    * 英字、数字、アンダースコア、ハイフンのみを含むこと
    * 連続するピリオド（..）を含まないこと
    * 有効な IPv4 アドレスでないこと
    * 例: `my-collection-123` は有効
    * 例: `my..collection` は無効（ピリオドの連続）
  </TabItem>

  <TabItem value="astra-naming" label="Astra">
    コレクション名は次の条件を満たす必要があります:

    * 空でないこと
    * 48文字以下であること
    * 英字、数字、アンダースコアのみを含むこと
    * 例: `my_collection_123` は有効です
    * 例: `my-collection` は無効です（ハイフンが含まれているため）
  </TabItem>

  <TabItem value="libsql-naming" label="LibSQL">
    インデックス名は次の条件を満たす必要があります:

    * 先頭は英字またはアンダースコアであること
    * 使用できるのは英字、数字、アンダースコアのみ
    * 例: `my_index_123` は有効
    * 例: `my-index` は無効（ハイフンを含むため）
  </TabItem>

  <TabItem value="Upstash の命名" label="Upstash">
    Namespace 名は次を満たす必要があります:

    * 2〜100文字であること
    * 次のみを含むこと:
      * 英数字 (a-z, A-Z, 0-9)
      * アンダースコア、ハイフン、ドット
    * 特殊文字 (&#95;, -, .) で始めたり終わったりしないこと
    * 大文字と小文字を区別することがある
    * 例: `MyNamespace123` は有効
    * 例: `_namespace` は無効 (先頭がアンダースコア)
  </TabItem>

  <TabItem value="cloudflare-naming" label="Cloudflare">
    インデックス名は次の条件を満たす必要があります:

    * 文字で始まる
    * 32文字未満である
    * 小文字のASCII英字、数字、ダッシュのみを含む
    * 空白の代わりにダッシュを使用する
    * 例: `my-index-123` は有効
    * 例: `My_Index` は無効（大文字とアンダースコアを含む）
  </TabItem>

  <TabItem value="opensearch-naming" label="OpenSearch">
    インデックス名は次を満たす必要があります:

    * 小文字のみを使用すること
    * 先頭をアンダースコアまたはハイフンにしないこと
    * 空白やカンマを含めないこと
    * 特殊文字を含めないこと（例: `:`, `"`, `*`, `+`, `/`, `\`, `|`, `?`, `#`, `>`, `<`）
    * 例: `my-index-123` は有効
    * 例: `My_Index` は無効（大文字を含むため）
    * 例: `_myindex` は無効（先頭がアンダースコアのため）
  </TabItem>

  <TabItem value="s3vectors の命名" label="S3 ベクトル">
    インデックス名は次の条件を満たす必要があります:

    * 同一のベクターバケット内で一意であること
    * 3〜63文字であること
    * 小文字の英字（`a–z`）、数字（`0–9`）、ハイフン（`-`）、ドット（`.`）のみを使用すること
    * 英字または数字で始まり、英字または数字で終わること
    * 例: `my-index.123` は有効
    * 例: `my_index` は無効（アンダースコアを含む）
    * 例: `-myindex` は無効（先頭がハイフン）
    * 例: `myindex-` は無効（末尾がハイフン）
    * 例: `MyIndex` は無効（大文字を含む）
  </TabItem>
</Tabs>

### 埋め込みのアップサート \{#upserting-embeddings\}

インデックスを作成した後、埋め込みを基本的なメタデータと一緒に保存できます。

```ts filename="store-embeddings.ts" showLineNumbers copy
// 対応するメタデータとともに埋め込みを保存する
await store.upsert({
  indexName: 'myCollection', // インデックス名
  vectors: embeddings, // 埋め込みベクトルの配列
  metadata: chunks.map(chunk => ({
    text: chunk.text, // 元のテキスト内容
    id: chunk.id, // 任意の一意の識別子
  })),
});
```

アップサート操作では次のことを行います:

* 埋め込みベクトルの配列と対応するメタデータを受け取る
* 同じIDの既存ベクトルを更新する
* 存在しない場合は新しいベクトルを作成する
* 大規模データセットに対して自動的にバッチ処理を行う

さまざまなベクターストアでの埋め込みのアップサート例については、[Upsert Embeddings](/docs/examples/rag/upsert/upsert-embeddings) ガイドをご覧ください。

## メタデータの追加 \{#adding-metadata\}

ベクターストアは、フィルタリングや整理のためにリッチなメタデータ（JSONでシリアライズ可能な任意のフィールド）をサポートします。メタデータは固定スキーマなしで保存されるため、予期しないクエリ結果を避けるにはフィールド名を一貫させてください。

**重要**: メタデータはベクターストレージにとって不可欠です。これがないと、元のテキストを返したり結果をフィルタリングしたりする手段のない数値ベクトル（埋め込み）しか得られません。少なくともソーステキストはメタデータとして必ず保存してください。

```ts showLineNumbers copy
// 整理とフィルタリングを向上させるため、リッチなメタデータ付きで埋め込みを保存する
await store.upsert({
  indexName: 'myCollection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({
    // 基本内容
    text: chunk.text,
    id: chunk.id,

    // ドキュメントの編成
    source: chunk.source,
    category: chunk.category,

    // 時間情報メタデータ
    createdAt: new Date().toISOString(),
    version: '1.0',

    // カスタムフィールド
    language: chunk.language,
    author: chunk.author,
    confidenceScore: chunk.score,
  })),
});
```

メタデータに関する主な注意点:

* フィールド名は厳密に統一すること — ‘category’ と ‘Category’ のような不一致はクエリに影響します
* フィルターやソートに使う予定のフィールドだけを含めること — 余計なフィールドはオーバーヘッドになります
* コンテンツの鮮度を把握できるよう、タイムスタンプ（例: ‘createdAt’, ‘lastUpdated’）を追加すること

## ベストプラクティス \{#best-practices\}

* 一括挿入の前にインデックスを作成する
* 大量挿入にはバッチ処理を使う（`upsert` メソッドは自動でバッチ化を行います）
* クエリに使用するメタデータだけを保存する
* 埋め込み次元をモデルに合わせる（例: `text-embedding-3-small` は 1536）