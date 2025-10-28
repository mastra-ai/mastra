---
title: "DatabaseConfig"
description: Mastra の RAG システムでベクター検索ツールと併用される、データベース固有の設定タイプに関する API リファレンス。
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# DatabaseConfig \{#databaseconfig\}

`DatabaseConfig` 型は、ベクタークエリツールの使用時に、データベース固有の設定を指定するための型です。これらの設定により、ベクターストアごとの固有の機能や最適化を活用できます。

## 型定義 \{#type-definition\}

```typescript
export type DatabaseConfig = {
  pinecone?: PineconeConfig;
  pgvector?: PgVectorConfig;
  chroma?: ChromaConfig;
  [key: string]: any; // 将来のデータベース用に拡張可能
};
```

## データベース固有型 \{#database-specific-types\}

### PineconeConfig \{#pineconeconfig\}

Pinecone のベクターストアに特化した設定オプション。

<PropertiesTable
  content={[
{
name: "namespace",
type: "string",
description: "同一インデックス内でベクターを整理・分離するための Pinecone の namespace。マルチテナンシーや環境の切り分けに有用。",
isOptional: true,
},
{
name: "sparseVector",
type: "{ indices: number[]; values: number[]; }",
description: "密ベクターと疎ベクターを組み合わせたハイブリッド検索のための疎ベクター。キーワードベースのクエリでの検索品質を向上させる。indices 配列と values 配列は同じ長さである必要がある。",
isOptional: true,
properties: [
{
type: "object",
parameters: [
{
name: "indices",
description: "疎ベクターの各要素に対応するインデックスの配列",
isOptional: false,
type: "number[]",
},
{
name: "values",
description: "各インデックスに対応する値の配列",
isOptional: false,
type: "number[]",
},
],
},
],
},
]}
/>

**ユースケース:**

* マルチテナントアプリケーション（テナントごとに namespace を分離）
* 環境の切り分け（dev/staging/prod の namespace）
* セマンティック検索とキーワード一致を組み合わせたハイブリッド検索

### PgVectorConfig \{#pgvectorconfig\}

pgvector 拡張機能を有効にした PostgreSQL 向けの設定オプション。

<PropertiesTable
  content={[
{
name: "minScore",
type: "number",
description: "結果に対する最小類似度スコアのしきい値。この値を上回る類似度スコアのベクターのみ返されます。",
isOptional: true,
},
{
name: "ef",
type: "number",
description: "検索時の動的候補リストのサイズを制御する HNSW の検索パラメータ。値を大きくすると精度は向上しますが速度は低下します。一般的には topK と 200 の間で設定します。",
isOptional: true,
},
{
name: "probes",
type: "number",
description: "検索時に訪問するインデックスセルの数を指定する IVFFlat の probe パラメータ。値を大きくすると再現率は向上しますが速度は低下します。",
isOptional: true,
},
]}
/>

**パフォーマンスガイドライン:**

* **ef**: topK の 2～4 倍から開始し、精度向上が必要に応じて増やす
* **probes**: 1～10 から開始し、再現率向上のために増やす
* **minScore**: 品質要件に応じて 0.5～0.9 の範囲で設定

**ユースケース:**

* 高負荷シナリオにおけるパフォーマンス最適化
* 無関係な結果の除外に向けた品質フィルタリング
* 検索精度と速度のトレードオフの微調整

### ChromaConfig \{#chromaconfig\}

Chroma ベクターストアに特化した設定オプション。

<PropertiesTable
  content={[
{
name: "where",
type: "Record<string, any>",
description: "MongoDB 風のクエリ構文を使ったメタデータのフィルタ条件。メタデータのフィールドに基づいて結果を絞り込みます。",
isOptional: true,
},
{
name: "whereDocument",
type: "Record<string, any>",
description: "ドキュメント本文のフィルタ条件。実際のテキスト内容に基づいて絞り込みできます。",
isOptional: true,
},
]}
/>

**フィルタ構文の例:**

```typescript
// シンプルな等価条件
where: { "category": "technical" }

// 演算子
where: { "price": { "$gt": 100 } }

// 複数の条件
where: {
  "category": "electronics",
  "inStock": true
}

// ドキュメントコンテンツのフィルタリング
whereDocument: { "$contains": "API documentation" }
```

**ユースケース:**

* 高度なメタデータのフィルタリング
* コンテンツに基づくドキュメントのフィルタリング
* 複合的なクエリの組み合わせ

## 使用例 \{#usage-examples\}

<Tabs>
  <TabItem value="basic-database-configuration" label="基本的な使い方">
    ### 基本的なデータベース構成 \{#basic-database-configuration\}

    ```typescript
    import { createVectorQueryTool } from '@mastra/rag';

    const vectorTool = createVectorQueryTool({
      vectorStoreName: 'pinecone',
      indexName: 'documents',
      model: embedModel,
      databaseConfig: {
        pinecone: {
          namespace: 'production'
        }
      }
    });
    ```
  </TabItem>

  <TabItem value="runtime-configuration-override" label="ランタイムでの上書き">
    ### ランタイム設定の上書き \{#runtime-configuration-override\}

    ```typescript
    import { RuntimeContext } from '@mastra/core/runtime-context';

    // 初期設定
    const vectorTool = createVectorQueryTool({
      vectorStoreName: 'pinecone',
      indexName: 'documents',
      model: embedModel,
      databaseConfig: {
        pinecone: {
          namespace: 'development'
        }
      }
    });

    // 実行時に上書き
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('databaseConfig', {
      pinecone: {
        namespace: 'production'
      }
    });

    await vectorTool.execute({
      context: { queryText: 'search query' },
      mastra,
      runtimeContext
    });
    ```
  </TabItem>

  <TabItem value="multi-database-configuration" label="マルチデータベース">
    ### マルチデータベース構成 \{#multi-database-configuration\}

    ```typescript
    const vectorTool = createVectorQueryTool({
      vectorStoreName: 'dynamic', // 実行時に決定
      indexName: 'documents',
      model: embedModel,
      databaseConfig: {
        pinecone: {
          namespace: 'default'
        },
        pgvector: {
          minScore: 0.8,
          ef: 150
        },
        chroma: {
          where: { 'type': 'documentation' }
        }
      }
    });
    ```

    :::note

    **マルチデータベース対応**: 複数のデータベースを構成した場合、実際に使用されるベクトルストアに一致する設定のみが適用されます。

    :::
  </TabItem>

  <TabItem value="performance-tuning" label="パフォーマンス">
    ### パフォーマンスチューニング \{#performance-tuning\}

    ```typescript
    // 高精度構成
    const highAccuracyTool = createVectorQueryTool({
      vectorStoreName: 'postgres',
      indexName: 'embeddings',
      model: embedModel,
      databaseConfig: {
        pgvector: {
          ef: 400,        // 高精度
          probes: 20,     // 高再現率
          minScore: 0.85  // 高品質しきい値
        }
      }
    });

    // 高速構成
    const highSpeedTool = createVectorQueryTool({
      vectorStoreName: 'postgres',
      indexName: 'embeddings',
      model: embedModel,
      databaseConfig: {
        pgvector: {
          ef: 50,         // 精度は下がるが高速
          probes: 3,      // 再現率は下がるが高速
          minScore: 0.6   // 品質しきい値を低めに設定
        }
      }
    });
    ```
  </TabItem>
</Tabs>

## 拡張性 \{#extensibility\}

`DatabaseConfig` 型は拡張しやすいように設計されています。新しいベクターデータベースへの対応を追加するには：

```typescript
// 1. 設定インターフェースを定義
export interface NewDatabaseConfig {
  customParam1?: string;
  customParam2?: number;
}

// 2. DatabaseConfig型を拡張
export type DatabaseConfig = {
  pinecone?: PineconeConfig;
  pgvector?: PgVectorConfig;
  chroma?: ChromaConfig;
  newdatabase?: NewDatabaseConfig;
  [key: string]: any;
};

// 3. ベクトルクエリツールで使用
const vectorTool = createVectorQueryTool({
  vectorStoreName: 'newdatabase',
  indexName: 'documents',
  model: embedModel,
  databaseConfig: {
    newdatabase: {
      customParam1: 'value',
      customParam2: 42,
    },
  },
});
```

## ベストプラクティス \{#best-practices\}

1. **環境設定**: 環境ごとに異なる名前空間や設定を用意する
2. **パフォーマンス調整**: まずはデフォルト値から始め、要件に応じて最適化する
3. **品質フィルタリング**: 低品質な結果を除外するために minScore を活用する
4. **実行時の柔軟性**: 動的なシナリオに対応できるよう、実行時に設定を上書きする
5. **ドキュメント化**: チーム向けに、採用した設定の理由や内容を記録する

## 移行ガイド \{#migration-guide\}

既存のベクター検索ツールは変更なしでそのまま利用できます。データベースの設定を追加するには：

```diff
const vectorTool = createVectorQueryTool({
  vectorStoreName: 'pinecone',
  indexName: 'documents',
  model: embedModel,
+ databaseConfig: {
+   pinecone: {
+     namespace: 'production'
+   }
+ }
});
```

## 関連項目 \{#related\}

* [createVectorQueryTool()](/docs/reference/tools/vector-query-tool)
* [ハイブリッド・ベクター検索](/docs/examples/rag/query/hybrid-vector-search)
* [メタデータフィルタ](/docs/reference/rag/metadata-filters)