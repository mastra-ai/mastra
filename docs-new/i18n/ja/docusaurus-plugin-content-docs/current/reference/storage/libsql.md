---
title: "LibSQL ストレージ"
description: Mastra における LibSQL ストレージ実装のドキュメントです。
---

# LibSQL ストレージ \{#libsql-storage\}

LibSQL のストレージ実装は、メモリ内および永続データベースとして動作可能な、SQLite 互換のストレージソリューションを提供します。

## インストール \{#installation\}

```bash copy
npm install @mastra/libsql@latest
```

## 使用方法 \{#usage\}

```typescript copy showLineNumbers
import { LibSQLStore } from '@mastra/libsql';

// ファイルデータベース(開発用)
const storage = new LibSQLStore({
  url: 'file:./storage.db',
});

// 永続データベース(本番用)
const storage = new LibSQLStore({
  url: process.env.DATABASE_URL,
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "url",
type: "string",
description:
"データベースの URL。インメモリーデータベースには ':memory:'、ファイルデータベースには 'file:filename.db'、永続的なストレージには LibSQL 互換の任意の接続文字列を使用します。",
isOptional: false,
},
{
name: "authToken",
type: "string",
description: "リモート LibSQL データベース用の認証トークン。",
isOptional: true,
},
]}
/>

## 追記 \{#additional-notes\}

### インメモリ vs 永続ストレージ \{#in-memory-vs-persistent-storage\}

ファイル設定（`file:storage.db`）は次の用途に適しています:

* 開発・テスト
* 一時的な保存
* 手早いプロトタイピング

本番環境では、永続的なデータベースのURLを使用してください: `libsql://your-database.turso.io`

### スキーマ管理 \{#schema-management\}

ストレージ実装はスキーマの作成と更新を自動的に行います。次のテーブルが作成されます：

* `mastra_workflow_snapshot`: ワークフローの状態と実行データを保存
* `mastra_evals`: 評価結果とメタデータを保存
* `mastra_threads`: 会話スレッドを保存
* `mastra_messages`: 個別のメッセージを保存
* `mastra_traces`: テレメトリとトレースデータを保存
* `mastra_scorers`: スコアリングおよび評価データを保存
* `mastra_resources`: リソースのワーキングメモリデータを保存