---
title: "Cloudflare Storage "
description: Mastra における Cloudflare KV ストレージ実装のドキュメント
---

# Cloudflare Storage \{#cloudflare-storage\}

Cloudflare KV ストレージ実装は、Cloudflare Workers KV を用いて、グローバル分散型のサーバーレスなキー値ストアを提供します。

## インストール \{#installation\}

```bash copy
npm install @mastra/cloudflare@latest
```

## 使い方 \{#usage\}

```typescript copy showLineNumbers
import { CloudflareStore } from '@mastra/cloudflare';

// --- 例1: Workers バインディングの使用 ---
const storageWorkers = new CloudflareStore({
  bindings: {
    threads: THREADS_KV, // threads テーブルの KVNamespace バインディング
    messages: MESSAGES_KV, // messages テーブルの KVNamespace バインディング
    // 必要に応じて他のテーブルを追加
  },
  keyPrefix: 'dev_', // オプション: 環境ごとにキーを分離
});

// --- 例2: REST API の使用 ---
const storageRest = new CloudflareStore({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!, // Cloudflare アカウント ID
  apiToken: process.env.CLOUDFLARE_API_TOKEN!, // Cloudflare API トークン
  namespacePrefix: 'dev_', // オプション: 環境ごとに名前空間を分離
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "bindings",
type: "Record<string, KVNamespace>",
description: "Cloudflare Workers KV のバインディング（Workers ランタイム用）",
isOptional: true,
},
{
name: "accountId",
type: "string",
description: "Cloudflare アカウント ID（REST API 用）",
isOptional: true,
},
{
name: "apiToken",
type: "string",
description: "Cloudflare API トークン（REST API 用）",
isOptional: true,
},
{
name: "namespacePrefix",
type: "string",
description:
"すべてのネームスペース名に付与する任意のプレフィックス（環境分離に便利）",
isOptional: true,
},
{
name: "keyPrefix",
type: "string",
description:
"すべてのキーに付与する任意のプレフィックス（環境分離に便利）",
isOptional: true,
},
]}
/>

#### 追記 \{#additional-notes\}

### スキーマ管理 \{#schema-management\}

このストレージ実装はスキーマの作成と更新を自動的に行います。以下のテーブルを作成します:

* `threads`: 会話スレッドを格納
* `messages`: 個々のメッセージを格納
* `metadata`: スレッドとメッセージの追加メタデータを格納

### 一貫性と伝播 \{#consistency-propagation\}

Cloudflare KV は最終的整合性のデータストアであり、書き込み直後はすべてのリージョンでデータが利用できない場合があります。

### キー構造と名前空間 \{#key-structure-namespacing\}

Cloudflare KV のキーは、設定可能な接頭辞とテーブル固有の形式（例：`threads:threadId`）を組み合わせた構造になっています。
Workers のデプロイでは、`keyPrefix` により同一名前空間内のデータを区別します。REST API のデプロイでは、`namespacePrefix` により環境やアプリケーション間で名前空間全体を分離します。