---
title: "createVectorQueryTool() "
description: Mastra の Vector Query Tool に関するドキュメント。フィルタリングやリランキング機能を備え、ベクターストア上でのセマンティック検索を実現します。
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# createVectorQueryTool() \{#createvectorquerytool\}

`createVectorQueryTool()` 関数は、ベクトルストアに対するセマンティック検索用のツールを作成します。フィルタリング、リランキング、データベース固有の設定に対応し、各種ベクトルストアのバックエンドと統合できます。

## 基本的な使い方 \{#basic-usage\}

```typescript
import { openai } from '@ai-sdk/openai';
import { createVectorQueryTool } from '@mastra/rag';

const queryTool = createVectorQueryTool({
  vectorStoreName: 'pinecone',
  indexName: 'docs',
  model: openai.embedding('text-embedding-3-small'),
});
```

## パラメータ \{#parameters\}

:::note

**パラメータ要件:** ほとんどのフィールドは作成時にデフォルトとして設定できます。
一部のフィールドはランタイムのコンテキストまたは入力で上書きできます。必須フィールドが作成時とランタイムの両方で欠落している場合はエラーがスローされます。なお、`model`、`id`、`description` は作成時にのみ設定できます。

:::

<PropertiesTable
  content={[
{
name: "id",
type: "string",
description:
"ツールのカスタム ID。デフォルト: 'VectorQuery {vectorStoreName} {indexName} Tool'。（作成時のみ設定可能）",
isOptional: true,
},
{
name: "description",
type: "string",
description:
"ツールのカスタム説明。デフォルト: 'Access the knowledge base to find information needed to answer user questions'（作成時のみ設定可能）",
isOptional: true,
},
{
name: "model",
type: "EmbeddingModel",
description:
"ベクター検索に使用する埋め込みモデル。（作成時のみ設定可能）",
isOptional: false,
},
{
name: "vectorStoreName",
type: "string",
description:
"クエリ対象のベクターストア名。（作成時に設定、またはランタイムで上書き可能）",
isOptional: false,
},
{
name: "indexName",
type: "string",
description:
"ベクターストア内のインデックス名。（作成時に設定、またはランタイムで上書き可能）",
isOptional: false,
},
{
name: "enableFilter",
type: "boolean",
description:
"メタデータに基づく結果のフィルタリングを有効化。（作成時のみ設定可能。ただし、ランタイムコンテキストでフィルターが指定された場合は自動的に有効になります）",
isOptional: true,
defaultValue: "false",
},
{
name: "includeVectors",
type: "boolean",
description:
"結果に埋め込みベクターを含める。（作成時に設定、またはランタイムで上書き可能）",
isOptional: true,
defaultValue: "false",
},
{
name: "includeSources",
type: "boolean",
description:
"結果に取得オブジェクト一式を含める。（作成時に設定、またはランタイムで上書き可能）",
isOptional: true,
defaultValue: "true",
},
{
name: "reranker",
type: "RerankConfig",
description:
"結果のリランキング用オプション。（作成時に設定、またはランタイムで上書き可能）",
isOptional: true,
},
{
name: "databaseConfig",
type: "DatabaseConfig",
description:
"クエリ最適化のためのデータベース固有の設定オプション。（作成時に設定、またはランタイムで上書き可能）",
isOptional: true,
},
{
name: "providerOptions",
type: "Record<string, Record<string, any>>",
description:
"埋め込みモデルのプロバイダー固有のオプション（例: outputDimensionality）。**重要**: AI SDK の EmbeddingModelV2 モデルでのみ機能します。V1 モデルでは、モデル作成時にオプションを設定してください。",
isOptional: true,
},
]}
/>

### DatabaseConfig \{#databaseconfig\}

`DatabaseConfig` 型では、クエリ操作に自動適用されるデータベース固有の設定を指定できます。これにより、各種ベクターストアが提供する固有の機能や最適化を活用できます。

<PropertiesTable
  content={[
{
name: "pinecone",
type: "PineconeConfig",
description: "Pinecone ベクターストア向けの設定",
isOptional: true,
properties: [
{
type: "object",
parameters: [
{
name: "namespace",
description: "ベクトルを整理するための Pinecone の namespace",
isOptional: true,
type: "string",
},
{
name: "sparseVector",
description: "ハイブリッド検索向けのスパースベクトル",
isOptional: true,
type: "{ indices: number[]; values: number[]; }",
},
],
},
],
},
{
name: "pgvector",
type: "PgVectorConfig",
description: "pgvector 拡張を用いる PostgreSQL 向けの設定",
isOptional: true,
properties: [
{
type: "object",
parameters: [
{
name: "minScore",
description: "結果の最小類似度スコアのしきい値",
isOptional: true,
type: "number",
},
{
name: "ef",
description: "HNSW の検索パラメータ（精度と速度のトレードオフを制御）",
isOptional: true,
type: "number",
},
{
name: "probes",
description: "IVFFlat の probe パラメータ（検索時に訪れるセル数）",
isOptional: true,
type: "number",
},
],
},
],
},
{
name: "chroma",
type: "ChromaConfig",
description: "Chroma ベクターストア向けの設定",
isOptional: true,
properties: [
{
type: "object",
parameters: [
{
name: "where",
description: "メタデータのフィルタ条件",
isOptional: true,
type: "Record<string, any>",
},
{
name: "whereDocument",
description: "ドキュメント内容のフィルタ条件",
isOptional: true,
type: "Record<string, any>",
},
],
},
],
},
]}
/>

### RerankConfig \{#rerankconfig\}

<PropertiesTable
  content={[
{
name: "model",
type: "MastraLanguageModel",
description: "リランキングに使用する言語モデル",
isOptional: false,
},
{
name: "options",
type: "RerankerOptions",
description: "リランキング処理のオプション",
isOptional: true,
properties: [
{
type: "object",
parameters: [
{
name: "weights",
description:
"スコアリング要素の重み（semantic: 0.4、vector: 0.4、position: 0.2）",
isOptional: true,
type: "WeightConfig",
},
{
name: "topK",
description: "返す上位結果の件数",
isOptional: true,
type: "number",
defaultValue: "3",
},
],
},
],
},
]}
/>

## 返り値 \{#returns\}

このツールは、次のプロパティを持つオブジェクトを返します:

<PropertiesTable
  content={[
{
name: "relevantContext",
type: "string",
description: "最も関連性の高いドキュメントのチャンクから統合したテキスト",
},
{
name: "sources",
type: "QueryResult[]",
description:
"完全な取得結果オブジェクトの配列。各オブジェクトには、元のドキュメント、チャンク、類似度スコアを参照するために必要な情報がすべて含まれます。",
},
]}
/>

### QueryResult オブジェクトの構成 \{#queryresult-object-structure\}

```typescript
{
  id: string;         // 一意のチャンク/ドキュメント識別子
  metadata: any;      // すべてのメタデータフィールド（ドキュメントIDなど）
  vector: number[];   // 埋め込みベクトル（利用可能な場合）
  score: number;      // この検索の類似度スコア
  document: string;   // 完全なチャンク/ドキュメントテキスト（利用可能な場合）
}
```

## デフォルトのツールの説明 \{#default-tool-description\}

デフォルトの説明では次の点に重点を置いています：

* 保存された知識から関連情報を見つける
* ユーザーの質問に答える
* 事実に基づくコンテンツを取得する

## 結果の扱い \{#result-handling\}

このツールはユーザーのクエリに応じて返す結果数を決定し、既定では10件を返します。必要に応じて、この数はクエリの要件に合わせて調整できます。

## フィルターの例 \{#example-with-filters\}

```typescript
const queryTool = createVectorQueryTool({
  vectorStoreName: 'pinecone',
  indexName: 'docs',
  model: openai.embedding('text-embedding-3-small'),
  enableFilter: true,
});
```

フィルタリングを有効にすると、ツールはクエリを処理してメタデータフィルターを構築し、セマンティック検索と組み合わせます。処理の流れは次のとおりです。

1. ユーザーが「&#39;version&#39; フィールドが 2.0 より大きいコンテンツを見つけて」のような、特定のフィルター要件を含むクエリを行う
2. エージェントがクエリを解析し、適切なフィルターを構築する:
   ```typescript
   {
      "version": { "$gt": 2.0 }
   }
   ```

このエージェント駆動のアプローチでは、次のことを行います。

* 自然言語のクエリをフィルター仕様に変換する
* ベクターストア固有のフィルター構文を適用する
* クエリ用語をフィルター演算子にマッピングする

フィルター構文の詳細やストア固有の機能については、[Metadata Filters](../rag/metadata-filters) のドキュメントを参照してください。

エージェント駆動のフィルタリングがどのように機能するかの例は、[Agent-Driven Metadata Filtering](/docs/examples/rag/usage/filter-rag) を参照してください。

## リランキングの例 \{#example-with-reranking\}

```typescript
const queryTool = createVectorQueryTool({
  vectorStoreName: 'milvus',
  indexName: 'documentation',
  model: openai.embedding('text-embedding-3-small'),
  reranker: {
    model: openai('gpt-4o-mini'),
    options: {
      weights: {
        semantic: 0.5, // セマンティック関連性の重み
        vector: 0.3, // ベクトル類似度の重み
        position: 0.2, // 元の位置の重み
      },
      topK: 5,
    },
  },
});
```

リランキングは次の要素を組み合わせて結果の品質を高めます：

* セマンティック関連性：LLM を用いたテキスト類似度のスコアリング
* ベクトル類似度：元のベクトル距離スコア
* 位置バイアス：元の結果の並び順の考慮
* クエリ分析：クエリ特性に基づく調整

リランカーは初期のベクトル検索結果を処理し、関連性を最適化した並べ替え済みリストを返します。

## カスタムの説明を使用した例 \{#example-with-custom-description\}

```typescript
const queryTool = createVectorQueryTool({
  vectorStoreName: 'pinecone',
  indexName: 'docs',
  model: openai.embedding('text-embedding-3-small'),
  description:
    '会社のポリシーや手順に関する質問に答えるため、ドキュメントアーカイブから関連情報を検索します',
});
```

この例では、情報検索という本来の目的を保ちながら、特定のユースケースに合わせてツールの説明をカスタマイズする方法を示します。

## データベース固有の設定例 \{#database-specific-configuration-examples\}

`databaseConfig` パラメータを使うと、各ベクターデータベース特有の機能や最適化を活用できます。これらの設定はクエリ実行時に自動適用されます。

<Tabs>
  <TabItem value="pinecone-configuration" label="Pinecone">
    ### Pinecone の設定 \{#pinecone-configuration\}

    ```typescript
    const pineconeQueryTool = createVectorQueryTool({
      vectorStoreName: "pinecone",
      indexName: "docs",
      model: openai.embedding("text-embedding-3-small"),
      databaseConfig: {
        pinecone: {
          namespace: "production",  // 環境ごとにベクターを整理
          sparseVector: {           // ハイブリッド検索を有効化
            indices: [0, 1, 2, 3],
            values: [0.1, 0.2, 0.15, 0.05]
          }
        }
      }
    });
    ```

    **Pinecone の機能:**

    * **Namespace**: 同一インデックス内でデータセットを分離
    * **Sparse Vector**: dense と sparse の埋め込みを組み合わせて検索精度を向上
    * **ユースケース**: マルチテナントアプリ、ハイブリッド意味検索
  </TabItem>

  <TabItem value="pgvector-configuration" label="pgVector">
    ### pgVector の設定 \{#pgvector-configuration\}

    ```typescript
    const pgVectorQueryTool = createVectorQueryTool({
      vectorStoreName: "postgres",
      indexName: "embeddings",
      model: openai.embedding("text-embedding-3-small"),
      databaseConfig: {
        pgvector: {
          minScore: 0.7,    // 類似度70%以上のみ返す
          ef: 200,          // 値が高いほど精度向上、検索は遅くなる
          probes: 10        // IVFFlat: probes を増やすほど再現率が向上
        }
      }
    });
    ```

    **pgVector の機能:**

    * **minScore**: 低品質なマッチを除外
    * **ef (HNSW)**: HNSW インデックスの精度と速度のバランスを調整
    * **probes (IVFFlat)**: IVFFlat インデックスの再現率と速度のバランスを調整
    * **ユースケース**: パフォーマンスチューニング、品質フィルタリング
  </TabItem>

  <TabItem value="chroma-configuration" label="Chroma">
    ### Chroma の設定 \{#chroma-configuration\}

    ```typescript
    const chromaQueryTool = createVectorQueryTool({
      vectorStoreName: "chroma",
      indexName: "documents",
      model: openai.embedding("text-embedding-3-small"),
      databaseConfig: {
        chroma: {
          where: {                    // メタデータでフィルタ
            "category": "technical",
            "status": "published"
          },
          whereDocument: {            // ドキュメント本文でフィルタ
            "$contains": "API"
          }
        }
      }
    });
    ```

    **Chroma の機能:**

    * **where**: メタデータ項目でフィルタ
    * **whereDocument**: ドキュメント内容でフィルタ
    * **ユースケース**: 高度なフィルタリング、内容ベース検索
  </TabItem>

  <TabItem value="multiple-database-configurations" label="Multiple Configs">
    ### 複数データベースの設定 \{#multiple-database-configurations\}

    ```typescript
    // 複数のデータベース向けに設定（動的ストアに有用）
    const multiDbQueryTool = createVectorQueryTool({
      vectorStoreName: "dynamic-store", // 実行時に設定
      indexName: "docs",
      model: openai.embedding("text-embedding-3-small"),
      databaseConfig: {
        pinecone: {
          namespace: "default"
        },
        pgvector: {
          minScore: 0.8,
          ef: 150
        },
        chroma: {
          where: { "type": "documentation" }
        }
      }
    });
    ```

    **マルチ設定の利点:**

    * 1つのツールで複数のベクターストアをサポート
    * データベース固有の最適化を自動適用
    * 柔軟なデプロイシナリオ
  </TabItem>
</Tabs>

### ランタイム構成の上書き \{#runtime-configuration-override\}

さまざまな状況に対応するために、実行時にデータベース構成を上書きできます:

```typescript
import { RuntimeContext } from '@mastra/core/runtime-context';

const queryTool = createVectorQueryTool({
  vectorStoreName: 'pinecone',
  indexName: 'docs',
  model: openai.embedding('text-embedding-3-small'),
  databaseConfig: {
    pinecone: {
      namespace: 'development',
    },
  },
});

// 実行時にオーバーライド
const runtimeContext = new RuntimeContext();
runtimeContext.set('databaseConfig', {
  pinecone: {
    namespace: 'production', // 本番環境のネームスペースに切り替え
  },
});

const response = await agent.generate('デプロイに関する情報を検索', { runtimeContext });
```

このアプローチにより、次のことが可能になります：

* 環境（dev/staging/prod）の切り替え
* 負荷に応じたパフォーマンスパラメーターの調整
* リクエストごとの異なるフィルタリング戦略の適用

## 例：ランタイムコンテキストの使用 \{#example-using-runtime-context\}

```typescript
const queryTool = createVectorQueryTool({
  vectorStoreName: 'pinecone',
  indexName: 'docs',
  model: openai.embedding('text-embedding-3-small'),
});
```

ランタイムコンテキストを使用する場合、必須パラメータは実行時にランタイムコンテキスト経由で指定してください。

```typescript
const runtimeContext = new RuntimeContext<{
  vectorStoreName: string;
  indexName: string;
  topK: number;
  filter: VectorFilter;
  databaseConfig: DatabaseConfig;
}>();
runtimeContext.set('vectorStoreName', 'my-store');
runtimeContext.set('indexName', 'my-index');
runtimeContext.set('topK', 5);
runtimeContext.set('filter', { category: 'docs' });
runtimeContext.set('databaseConfig', {
  pinecone: { namespace: 'runtime-namespace' },
});
runtimeContext.set('model', openai.embedding('text-embedding-3-small'));

const response = await agent.generate('ナレッジベースからドキュメントを検索する。', {
  runtimeContext,
});
```

ランタイム コンテキストの詳細については、以下をご参照ください：

* [Agent Runtime Context](/docs/server-db/runtime-context)
* [Tool Runtime Context](/docs/tools-mcp/runtime-context)

## Mastra サーバーなしでの使用 \{#usage-without-a-mastra-server\}

このツールは、クエリに一致するドキュメントを取得するために単体で利用できます。

```typescript copy showLineNumbers filename="src/index.ts"
import { openai } from '@ai-sdk/openai';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { createVectorQueryTool } from '@mastra/rag';
import { PgVector } from '@mastra/pg';

const pgVector = new PgVector({
  connectionString: process.env.POSTGRES_CONNECTION_STRING!,
});

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector', // ストアを渡しているため省略可
  vectorStore: pgVector,
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
});

const runtimeContext = new RuntimeContext();
const queryResult = await vectorQueryTool.execute({
  context: { queryText: 'foo', topK: 1 },
  runtimeContext,
});

console.log(queryResult.sources);
```

## ツールの詳細 \{#tool-details\}

このツールは次の要素で構成されています：

* **ID**: `VectorQuery {vectorStoreName} {indexName} Tool`
* **入力スキーマ**: `queryText` と `filter` の各オブジェクトが必須
* **出力スキーマ**: `relevantContext` の文字列を返す

## 関連項目 \{#related\}

* [rerank()](../rag/rerank)
* [createGraphRAGTool](./graph-rag-tool)