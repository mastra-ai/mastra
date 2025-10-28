---
title: "DynamoDB ストレージ"
description: "Mastra における DynamoDB ストレージ実装のドキュメント。ElectroDB を使用したシングルテーブル設計を採用しています。"
---

# DynamoDB ストレージ \{#dynamodb-storage\}

DynamoDB ストレージ実装は、[ElectroDB](https://electrodb.dev/) を用いたシングルテーブル設計パターンを活用し、Mastra 向けにスケーラブルで高性能な NoSQL データベースソリューションを提供します。

## 機能 \{#features\}

* Mastraのあらゆるストレージ要件に対応する効率的な単一テーブル設計
* 型安全なDynamoDBアクセスを実現するElectroDBベースの実装
* AWSの認証情報、リージョン、エンドポイントをサポート
* 開発用途でAWS DynamoDB Localと互換
* Thread、Message、Trace、Eval、Workflowのデータを保存
* サーバーレス環境向けに最適化

## インストール \{#installation\}

```bash copy
npm install @mastra/dynamodb@latest
# または
pnpm add @mastra/dynamodb@latest
# または
yarn add @mastra/dynamodb@latest
```

## 前提条件 \{#prerequisites\}

このパッケージを使用する前に、プライマリキーと Global Secondary Index（GSI）を含む所定の構成で DynamoDB テーブルを作成しておく必要があります。このアダプターは、DynamoDB テーブルおよびその GSI が外部でプロビジョニング済みであることを前提としています。

AWS CloudFormation または AWS CDK を用いたテーブル設定の詳細な手順は、[TABLE&#95;SETUP.md](https://github.com/mastra-ai/mastra/blob/main/stores/dynamodb/TABLE_SETUP) に記載されています。先に進む前に、必ずその手順に従ってテーブルを構成してください。

## 使い方 \{#usage\}

### 基本的な使い方 \{#basic-usage\}

```typescript copy showLineNumbers
import { Memory } from '@mastra/memory';
import { DynamoDBStore } from '@mastra/dynamodb';

// DynamoDBストレージを初期化
const storage = new DynamoDBStore({
  name: 'dynamodb', // このストレージインスタンスの名前
  config: {
    tableName: 'mastra-single-table', // DynamoDBテーブルの名前
    region: 'us-east-1', // オプション:AWSリージョン、デフォルトは'us-east-1'
    // endpoint: "http://localhost:8000", // オプション:ローカルDynamoDB用
    // credentials: { accessKeyId: "YOUR_ACCESS_KEY", secretAccessKey: "YOUR_SECRET_KEY" } // オプション
  },
});

// 例:DynamoDBストレージでMemoryを初期化
const memory = new Memory({
  storage,
  options: {
    lastMessages: 10,
  },
});
```

### DynamoDB Local を使ったローカル開発 \{#local-development-with-dynamodb-local\}

ローカル開発では、[DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) を利用できます。

1. **DynamoDB Local を起動（例: Docker を使用）：**

   ```bash
   docker run -p 8000:8000 amazon/dynamodb-local
   ```

2. **`DynamoDBStore` をローカルエンドポイント向けに設定：**

   ```typescript copy showLineNumbers
   import { DynamoDBStore } from '@mastra/dynamodb';

   const storage = new DynamoDBStore({
     name: 'dynamodb-local',
     config: {
       tableName: 'mastra-single-table', // このテーブルがローカルの DynamoDB に作成されていることを確認してください
       region: 'localhost', // ローカルでは任意の文字列で可。一般的には 'localhost'
       endpoint: 'http://localhost:8000',
       // DynamoDB Local では、特別な設定がない限り通常は認証情報は不要です。
       // ローカル認証情報を設定している場合:
       // credentials: { accessKeyId: "fakeMyKeyId", secretAccessKey: "fakeSecretAccessKey" }
     },
   });
   ```

   なお、ローカルの DynamoDB インスタンスでもテーブルと GSI は作成する必要があります。たとえば、ローカルエンドポイントを指定した AWS CLI を使用してください。

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "ストレージインスタンスの名前。",
isOptional: false,
},
{
name: "config.tableName",
type: "string",
description: "使用する DynamoDB テーブル名。",
isOptional: false,
},
{
name: "config.region",
type: "string",
description:
"AWS のリージョン。既定値は 'us-east-1'。ローカル開発では 'localhost' などに設定可能。",
isOptional: true,
},
{
name: "config.endpoint",
type: "string",
description:
"DynamoDB のカスタムエンドポイント（例: ローカル開発用の 'http://localhost:8000'）。",
isOptional: true,
},
{
name: "config.credentials",
type: "object",
description:
"`accessKeyId` と `secretAccessKey` を含む AWS の認証情報オブジェクト。指定しない場合、AWS SDK は環境変数、IAM ロール（例: EC2/Lambda）、または共有の AWS 認証情報ファイルから認証情報の取得を試みます。",
isOptional: true,
},
]}
/>

## AWS IAM の権限 \{#aws-iam-permissions\}

コードを実行する IAM ロールまたはユーザーには、指定された DynamoDB テーブルおよびそのインデックスと連携するための適切な権限が必要です。以下はサンプルポリシーです。`${YOUR_TABLE_NAME}` を実際のテーブル名に、`${YOUR_AWS_REGION}` と `${YOUR_AWS_ACCOUNT_ID}` を適切な値に置き換えてください。

```json copy
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:DescribeTable",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${YOUR_AWS_REGION}:${YOUR_AWS_ACCOUNT_ID}:table/${YOUR_TABLE_NAME}",
        "arn:aws:dynamodb:${YOUR_AWS_REGION}:${YOUR_AWS_ACCOUNT_ID}:table/${YOUR_TABLE_NAME}/index/*"
      ]
    }
  ]
}
```

## 重要な考慮事項 \{#key-considerations\}

アーキテクチャの詳細に入る前に、DynamoDB ストレージアダプタを扱う際は次のポイントを念頭に置いてください:

* **外部テーブルのプロビジョニング:** このアダプタを使用する前に、DynamoDB テーブルとその Global Secondary Index (GSI) をご自身で作成・設定することが&#95;必須&#95;です。[TABLE&#95;SETUP.md](https://github.com/mastra-ai/mastra/blob/main/stores/dynamodb/TABLE_SETUP) の手順に従ってください。
* **シングルテーブル設計:** すべての Mastra データ（スレッド、メッセージなど）は 1 つの DynamoDB テーブルに保存されます。これは DynamoDB に最適化された意図的な設計判断であり、リレーショナルデータベースの手法とは異なります。
* **GSI の理解:** `TABLE_SETUP.md` に記載された GSI の構造を理解しておくことは、データの取得や想定されるクエリパターンを把握するうえで重要です。
* **ElectroDB:** このアダプタは DynamoDB とのやり取りを管理するために ElectroDB を使用し、生の DynamoDB 操作に対して抽象化レイヤーと型安全性を提供します。

## アーキテクチャ上のアプローチ \{#architectural-approach\}

このストレージアダプターは、DynamoDB で一般的かつ推奨されるアプローチである [ElectroDB](https://electrodb.dev/) を活用した**シングルテーブル設計パターン**を採用しています。これは、通常は特定のエンティティ（スレッド、メッセージなど）ごとに複数のテーブルを用いるリレーショナルデータベース向けアダプター（`@mastra/pg` や `@mastra/libsql` など）とはアーキテクチャが異なります。

このアプローチの主なポイント:

* **DynamoDB ネイティブ:** シングルテーブル設計は DynamoDB のキー・バリューおよびクエリ機能に最適化されており、リレーショナルモデルを模倣する場合と比べて、より高いパフォーマンスとスケーラビリティをもたらすことがよくあります。
* **外部でのテーブル管理:** コードからのテーブル作成支援機能を提供するアダプターもありますが、本アダプターは、使用前に**DynamoDB のテーブルおよび関連する Global Secondary Index（GSI）が外部でプロビジョニング済みであること**を前提とします。AWS CloudFormation や CDK などのツールを使った詳細な手順は [TABLE&#95;SETUP.md](https://github.com/mastra-ai/mastra/blob/main/stores/dynamodb/TABLE_SETUP) を参照してください。本アダプターは既存のテーブル構造とのやり取りに専念します。
* **インターフェースによる一貫性:** 基盤となるストレージモデルは異なっていても、このアダプターは他のアダプターと同じ `MastraStorage` インターフェースに準拠しており、Mastra の `Memory` コンポーネント内で相互運用・置換が可能です。

### 単一テーブルにおける Mastra データ \{#mastra-data-in-the-single-table\}

単一の DynamoDB テーブル内では、Threads、Messages、Traces、Evals、Workflows といった多様な Mastra のデータエンティティが、ElectroDB を用いて管理・区別されます。ElectroDB は各エンティティタイプごとに、固有のキー構造や属性を備えたモデルを定義します。これにより、アダプターは同一テーブル内で多様なデータ型を効率よく保存・取得できます。

たとえば、`Thread` アイテムは `THREAD#<threadId>` のようなパーティションキーを持ち、同じスレッドに属する `Message` アイテムはパーティションキーに `THREAD#<threadId>`、ソートキーに `MESSAGE#<messageId>` を用いる場合があります。`TABLE_SETUP.md` に詳述されている Global Secondary Indexes (GSI) は、スレッド内のすべてのメッセージ取得や、特定のワークフローに関連するトレースのクエリなど、これらの異なるエンティティ間に共通するアクセスパターンを支えるよう戦略的に設計されています。

### シングルテーブル設計の利点 \{#advantages-of-single-table-design\}

この実装は ElectroDB を用いたシングルテーブル設計パターンを採用しており、DynamoDB の文脈では次のような利点があります。

1. **コスト削減（場合によっては）:** テーブル数を減らすことで、特にオンデマンドキャパシティ使用時に、Read/Write Capacity Unit（RCU/WCU）のプロビジョニングと管理を簡素化できます。
2. **高いパフォーマンス:** 関連データを同一箇所に配置したり、GSI を通じて効率的にアクセスでき、一般的なアクセスパターンでの高速なルックアップが可能になります。
3. **運用の簡素化:** 監視・バックアップ・管理すべきテーブルの数が少なくなります。
4. **アクセスパターンの複雑性の低減:** ElectroDB により、単一テーブル上のアイテム種別やアクセスパターンの複雑性を適切に管理できます。
5. **トランザクション対応:** 必要に応じて、同一テーブルに格納された異なるエンティティタイプ間で DynamoDB のトランザクションを利用できます。