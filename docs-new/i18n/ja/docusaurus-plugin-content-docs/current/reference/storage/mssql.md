---
title: "MSSQL ストレージ"
description: Mastra における MSSQL ストレージ実装のドキュメント
---

# MSSQL ストレージ \{#mssql-storage\}

MSSQL ストレージ実装は、Microsoft SQL Server データベースを利用した本番環境向けのストレージソリューションを提供します。

## インストール \{#installation\}

```bash copy
npm install @mastra/mssql@latest
```

## 使い方 \{#usage\}

```typescript copy showLineNumbers
import { MSSQLStore } from '@mastra/mssql';

const storage = new MSSQLStore({
  connectionString: process.env.DATABASE_URL,
});
```

## パラメーター \{#parameters\}

<PropertiesTable
  content={[
{
name: "connectionString",
type: "string",
description:
"MSSQL の接続文字列（例：mssql://user:pass@host:1433/dbname）",
isOptional: false,
},
{
name: "schemaName",
type: "string",
description:
"ストレージで使用するスキーマ名。未指定の場合は既定のスキーマを使用します。",
isOptional: true,
},
]}
/>

## コンストラクターの例 \{#constructor-examples\}

`MSSQLStore` は次の方法でインスタンス化できます：

```ts
import { MSSQLStore } from '@mastra/mssql';

// 接続文字列のみを使用
const store1 = new MSSQLStore({
  connectionString: 'mssql://user:password@localhost:1433/mydb',
});

// カスタムスキーマ名を指定した接続文字列を使用
const store2 = new MSSQLStore({
  connectionString: 'mssql://user:password@localhost:1433/mydb',
  schemaName: 'custom_schema', // 任意
});

// 個別の接続パラメータを使用
const store4 = new MSSQLStore({
  server: 'localhost',
  port: 1433,
  database: 'mydb',
  user: 'user',
  password: 'password',
});

// schemaNameを指定した個別パラメータ
const store5 = new MSSQLStore({
  server: 'localhost',
  port: 1433,
  database: 'mydb',
  user: 'user',
  password: 'password',
  schemaName: 'custom_schema', // 任意
});
```

## 追記 \{#additional-notes\}

### スキーマ管理 \{#schema-management\}

ストレージ実装はスキーマの作成と更新を自動的に処理します。次のテーブルを作成します:

* `mastra_workflow_snapshot`: ワークフローの状態と実行データを保存
* `mastra_evals`: 評価結果とメタデータを保存
* `mastra_threads`: 会話スレッドを保存
* `mastra_messages`: 個々のメッセージを保存
* `mastra_traces`: テレメトリおよびトレースデータを保存
* `mastra_scorers`: スコアリングおよび評価データを保存
* `mastra_resources`: リソースのワーキングメモリデータを保存

### データベースおよびプールへの直接アクセス \{#direct-database-and-pool-access\}

`MSSQLStore` は mssql の接続プールをパブリックフィールドとして公開しています。

```typescript
store.pool; // mssql接続プールインスタンス
```

これにより、直接クエリの実行とカスタムトランザクション管理が可能になります。これらのフィールドを使用する際は、次の点にご注意ください:

* 適切な接続およびトランザクションの管理は、利用者の責任です。
* ストア（`store.close()`）を閉じると、関連する接続プールは破棄されます。
* 直接アクセスでは、MSSQLStore のメソッドが提供する追加のロジックや検証を迂回します。

このアプローチは、低レベルなアクセスが必要となる高度な用途を想定しています。
