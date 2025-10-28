---
title: "Cloudflare D1 ストレージ"
description: Mastra における Cloudflare D1 の SQL ストレージ実装に関するドキュメント。
---

# Cloudflare D1 ストレージ \{#cloudflare-d1-storage\}

Cloudflare D1 ストレージ実装は、Cloudflare D1 を用いてサーバーレスの SQL データベース ソリューションを提供し、リレーショナル操作とトランザクション整合性をサポートします。

## インストール \{#installation\}

```bash
npm install @mastra/cloudflare-d1@latest
```

## 使い方 \{#usage\}

```typescript copy showLineNumbers
import { D1Store } from '@mastra/cloudflare-d1';

type Env = {
  // ここにバインディングを追加します（例: Workers KV、D1、Workers AI など）
  D1Database: D1Database;
};

// --- 例1: Workersバインディングの使用 ---
const storageWorkers = new D1Store({
  binding: D1Database, // Workersランタイムから提供されるD1Databaseバインディング
  tablePrefix: 'dev_', // オプション: 環境ごとにテーブルを分離
});

// --- 例2: REST APIの使用 ---
const storageRest = new D1Store({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!, // CloudflareアカウントID
  databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!, // D1データベースID
  apiToken: process.env.CLOUDFLARE_API_TOKEN!, // Cloudflare APIトークン
  tablePrefix: 'dev_', // オプション: 環境ごとにテーブルを分離
});
```

次の内容を `wrangler.toml` または `wrangler.jsonc` ファイルに追加してください:

```
[[d1_databases]]
binding = "D1Database"
database_name = "db-name"
database_id = "db-id"
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "binding",
type: "D1Database",
description: "Cloudflare D1 の Workers バインディング（Workers ランタイム用）",
isOptional: true,
},
{
name: "accountId",
type: "string",
description: "Cloudflare アカウント ID（REST API 用）",
isOptional: true,
},
{
name: "databaseId",
type: "string",
description: "Cloudflare D1 データベース ID（REST API 用）",
isOptional: true,
},
{
name: "apiToken",
type: "string",
description: "Cloudflare API トークン（REST API 用）",
isOptional: true,
},
{
name: "tablePrefix",
type: "string",
description:
"すべてのテーブル名に付与する任意のプレフィックス（環境の分離に便利）",
isOptional: true,
},
]}
/>

## 追記事項 \{#additional-notes\}

### スキーマ管理 \{#schema-management\}

ストレージ実装はスキーマの作成と更新を自動で行います。次のテーブルが作成されます:

* `threads`: 会話スレッドを格納
* `messages`: 個々のメッセージを格納
* `metadata`: スレッドおよびメッセージの追加メタデータを格納

### トランザクションと一貫性 \{#transactions-consistency\}

Cloudflare D1 は、単一行の操作に対してトランザクションの保証を提供します。つまり、複数の操作を「すべて成功するか、まったく行われないか」の一体の作業単位として実行できます。

### テーブルの作成とマイグレーション \{#table-creation-migrations\}

テーブルはストレージの初期化時に自動的に作成されます（`tablePrefix` オプションを使えば環境ごとに分離可能）ですが、列の追加、データ型の変更、インデックスの調整といった高度なスキーマ変更には、データ損失を避けるために手動のマイグレーションと慎重な計画が必要です。