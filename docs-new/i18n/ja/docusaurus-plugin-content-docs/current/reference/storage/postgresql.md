---
title: "PostgreSQL ストレージ"
description: Mastra における PostgreSQL ストレージ実装のドキュメント
---

# PostgreSQL ストレージ \{#postgresql-storage\}

PostgreSQL のストレージ実装は、PostgreSQL データベースを用いた本番運用向けのストレージソリューションを提供します。

## インストール \{#installation\}

```bash copy
npm install @mastra/pg@latest
```

## 使い方 \{#usage\}

```typescript copy showLineNumbers
import { PostgresStore } from '@mastra/pg';

const storage = new PostgresStore({
  connectionString: process.env.DATABASE_URL,
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "connectionString",
type: "string",
description:
"PostgreSQL の接続文字列（例：postgresql://user:pass@host:5432/dbname）",
isOptional: false,
},
{
name: "schemaName",
type: "string",
description:
"ストレージで使用するスキーマ名。指定しない場合は既定のスキーマが使用されます。",
isOptional: true,
},
]}
/>

## コンストラクターの例 \{#constructor-examples\}

`PostgresStore` は次のいずれかの方法でインスタンス化できます：

```ts
import { PostgresStore } from '@mastra/pg';

// 接続文字列のみを使用
const store1 = new PostgresStore({
  connectionString: 'postgresql://user:password@localhost:5432/mydb',
});

// カスタムスキーマ名を指定した接続文字列を使用
const store2 = new PostgresStore({
  connectionString: 'postgresql://user:password@localhost:5432/mydb',
  schemaName: 'custom_schema', // 任意
});

// 個別の接続パラメータを使用
const store4 = new PostgresStore({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'user',
  password: 'password',
});

// schemaNameを指定した個別パラメータ
const store5 = new PostgresStore({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'user',
  password: 'password',
  schemaName: 'custom_schema', // 任意
});
```

## 追記事項 \{#additional-notes\}

### スキーマ管理 \{#schema-management\}

ストレージ実装はスキーマの作成と更新を自動で行います。次のテーブルを作成します：

* `mastra_workflow_snapshot`: ワークフローの状態と実行データを格納
* `mastra_evals`: 評価結果とメタデータを格納
* `mastra_threads`: 会話スレッドを格納
* `mastra_messages`: 個々のメッセージを格納
* `mastra_traces`: テレメトリおよびトレースデータを格納
* `mastra_scorers`: スコアリングおよび評価データを格納
* `mastra_resources`: リソースのワーキングメモリーデータを格納

### データベースとプールへの直接アクセス \{#direct-database-and-pool-access\}

`PostgresStore` は、基盤となるデータベースオブジェクトと pg-promise インスタンスの両方をパブリックフィールドとして公開しています。

```typescript
store.db; // pg-promise データベースインスタンス
store.pgp; // pg-promise メインインスタンス
```

これにより、直接クエリの実行や独自のトランザクション管理が可能になります。これらのフィールドを使用する場合は次の点に注意してください。

* 接続およびトランザクションの適切な管理は利用者の責任です。
* ストアを閉じる（`store.close()`）と、関連するコネクションプールが破棄されます。
* 直接アクセスは、PostgresStore のメソッドが提供する追加のロジックや検証を迂回します。

この方法は、低レベルのアクセスが必要となる高度なユースケースを想定しています。

## インデックス管理 \{#index-management\}

PostgreSQL ストレージは、クエリのパフォーマンスを最適化するための充実したインデックス管理機能を提供します。

### 自動パフォーマンスインデックス \{#automatic-performance-indexes\}

PostgreSQL ストレージでは、一般的なクエリパターンに合わせて、初期化時に複合インデックスが自動作成されます：

* `mastra_threads_resourceid_createdat_idx`: (resourceId, createdAt DESC)
* `mastra_messages_thread_id_createdat_idx`: (thread&#95;id, createdAt DESC)
* `mastra_traces_name_starttime_idx`: (name, startTime DESC)
* `mastra_evals_agent_name_created_at_idx`: (agent&#95;name, created&#95;at DESC)

これらのインデックスにより、フィルタ条件と並び替えを含むクエリのパフォーマンスが大幅に向上します。

### カスタムインデックスの作成 \{#creating-custom-indexes\}

特定のクエリパターンを最適化するために、追加のインデックスを作成します。

```typescript copy
// 一般的なクエリ用の基本インデックス
await storage.createIndex({
  name: 'idx_threads_resource',
  table: 'mastra_threads',
  columns: ['resourceId'],
});

// フィルタリングとソート用のソート順を含む複合インデックス
await storage.createIndex({
  name: 'idx_messages_composite',
  table: 'mastra_messages',
  columns: ['thread_id', 'createdAt DESC'],
});

// JSONB列用のGINインデックス(高速JSONクエリ)
await storage.createIndex({
  name: 'idx_traces_attributes',
  table: 'mastra_traces',
  columns: ['attributes'],
  method: 'gin',
});
```

さらに高度なユースケースでは、次のような指定も利用できます:

* `unique: true` 一意制約に使用
* `where: 'condition'` 部分インデックスに使用
* `method: 'brin'` 時系列データ向け
* `storage: { fillfactor: 90 }` 更新頻度の高いテーブル向け
* `concurrent: true` ブロックしない作成（デフォルト）

### インデックスオプション \{#index-options\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "インデックスの一意な名前",
isOptional: false,
},
{
name: "table",
type: "string",
description: "テーブル名（例: 'mastra_threads'）",
isOptional: false,
},
{
name: "columns",
type: "string[]",
description: "ソート順の指定も含められる列名の配列（例: ['id', 'createdAt DESC']）",
isOptional: false,
},
{
name: "unique",
type: "boolean",
description: "一意制約付きインデックスを作成",
isOptional: true,
},
{
name: "concurrent",
type: "boolean",
description: "テーブルをロックせずにインデックスを作成（既定: true）",
isOptional: true,
},
{
name: "where",
type: "string",
description: "部分インデックスの条件（PostgreSQL 固有）",
isOptional: true,
},
{
name: "method",
type: "'btree' | 'hash' | 'gin' | 'gist' | 'spgist' | 'brin'",
description: "インデックス方式（既定: 'btree'）",
isOptional: true,
},
{
name: "opclass",
type: "string",
description: "GIN/GIST インデックスのオペレータクラス",
isOptional: true,
},
{
name: "storage",
type: "Record<string, any>",
description: "ストレージパラメータ（例: { fillfactor: 90 }）",
isOptional: true,
},
{
name: "tablespace",
type: "string",
description: "インデックスを配置するテーブルスペース名",
isOptional: true,
}
]}
/>

### インデックスの管理 \{#managing-indexes\}

既存のインデックスを一覧し、監視する:

```typescript copy
// すべてのインデックスを一覧表示
const allIndexes = await storage.listIndexes();
console.log(allIndexes);
// [
//   {
//     name: 'mastra_threads_pkey',
//     table: 'mastra_threads',
//     columns: ['id'],
//     unique: true,
//     size: '16 KB',
//     definition: 'CREATE UNIQUE INDEX...'
//   },
//   ...
// ]

// 特定のテーブルのインデックスを一覧表示
const threadIndexes = await storage.listIndexes('mastra_threads');

// インデックスの詳細な統計情報を取得
const stats = await storage.describeIndex('idx_threads_resource');
console.log(stats);
// {
//   name: 'idx_threads_resource',
//   table: 'mastra_threads',
//   columns: ['resourceId', 'createdAt'],
//   unique: false,
//   size: '128 KB',
//   definition: 'CREATE INDEX idx_threads_resource...',
//   method: 'btree',
//   scans: 1542,           // インデックススキャンの回数
//   tuples_read: 45230,    // インデックス経由で読み取られたタプル
//   tuples_fetched: 12050  // インデックス経由で取得されたタプル
// }

// インデックスを削除
await storage.dropIndex('idx_threads_status');
```

### スキーマ専用のインデックス \{#schema-specific-indexes\}

カスタムスキーマを使用する場合、インデックスはスキーマのプレフィックス付きで作成されます:

```typescript copy
const storage = new PostgresStore({
  connectionString: process.env.DATABASE_URL,
  schemaName: 'custom_schema',
});

// custom_schema_idx_threads_status としてインデックスを作成
await storage.createIndex({
  name: 'idx_threads_status',
  table: 'mastra_threads',
  columns: ['status'],
});
```

### インデックスの種類とユースケース \{#index-types-and-use-cases\}

PostgreSQL は特定の用途に最適化されたさまざまなインデックス型を提供します。

| インデックス種別       | 最適な用途                               | ストレージ | 速度                           |
| ------------------- | ---------------------------------------- | ---------- | ------------------------------ |
| **btree**（デフォルト） | 範囲検索、並べ替え、汎用                  | 中程度     | 高速                           |
| **hash**            | 等価比較のみ                              | 小         | `=` に対して非常に高速         |
| **gin**             | JSONB、配列、全文検索                     | 大         | 包含（contains）に高速         |
| **gist**            | 幾何データ、全文検索                      | 中程度     | 近傍検索に高速                 |
| **spgist**          | 非平衡データ、テキストパターン            | 小         | 特定のパターンに高速           |
| **brin**            | 自然な順序を持つ大規模テーブル            | 非常に小   | 範囲検索に高速                 |