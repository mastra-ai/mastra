---
title: "LanceDB ストレージ"
description: Mastra における LanceDB ストレージ実装のドキュメント
---

# LanceDB ストレージ \{#lancedb-storage\}

LanceDB ストレージ実装は、LanceDB データベースシステムを用いた高性能なストレージソリューションです。従来型のデータ保存とベクトル処理の両方に優れた性能を発揮します。

## インストール \{#installation\}

```bash
npm install @mastra/lance
```

## 使い方 \{#usage\}

### ストレージの基本的な使い方 \{#basic-storage-usage\}

```typescript copy showLineNumbers
import { LanceStorage } from '@mastra/lance';

// ローカルデータベースに接続
const storage = await LanceStorage.create('my-storage', '/path/to/db');

// LanceDB クラウドデータベースに接続
const storage = await LanceStorage.create('my-storage', 'db://host:port');

// カスタムオプションでクラウドデータベースに接続
const storage = await LanceStorage.create('my-storage', 's3://bucket/db', {
  storageOptions: { timeout: '60s' },
});
```

## パラメーター \{#parameters\}

### LanceStorage.create() \{#lancestoragecreate\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "ストレージインスタンスの名前（識別子）",
isOptional: false,
},
{
name: "uri",
type: "string",
description:
"LanceDB データベースへ接続するための URI。ローカルパス、クラウド DB の URL、または S3 バケットの URL を指定可能",
isOptional: false,
},
{
name: "options",
type: "ConnectionOptions",
description:
"タイムアウト設定や認証など、LanceDB の接続オプション",
isOptional: true,
},
]}
/>

## 追記 \{#additional-notes\}

### スキーマ管理 \{#schema-management\}

LanceStorage の実装は、スキーマの作成と更新を自動的に行います。Mastra のスキーマ型を Apache Arrow のデータ型にマッピングし、これは LanceDB の内部で使用されます:

* `text`, `uuid` → Utf8
* `int`, `integer` → Int32
* `float` → Float32
* `jsonb`, `json` → Utf8（シリアライズ済み）
* `binary` → Binary

### デプロイ方法 \{#deployment-options\}

LanceDB のストレージは、さまざまなデプロイシナリオに合わせて設定できます:

* **ローカル開発**: 開発やテストではローカルのファイルパスを使用します
  ```
  /path/to/db
  ```
* **クラウドデプロイ**: ホストされた LanceDB インスタンスに接続します
  ```
  db://host:port
  ```
* **S3 ストレージ**: スケーラブルなクラウドストレージとして Amazon S3 を使用します
  ```
  s3://bucket/db
  ```

### テーブル管理 \{#table-management\}

LanceStorage はテーブル管理のためのメソッドを提供します:

* カスタムスキーマでテーブルを作成
* テーブルを削除
* テーブルをクリア（全レコードを削除）
* キーでレコードを読み込む
* 単一またはバッチでレコードを挿入