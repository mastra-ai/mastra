---
title: ストレージ
description: Mastraのストレージシステムとデータ永続化機能の概要
sidebar_position: 5
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import { SchemaTable } from '@site/src/components/SchemaTable';
import { StorageOverviewImage } from '@site/src/components/StorageOverviewImage';

# MastraStorage \{#mastrastorage\}

`MastraStorage` は、次の管理に対する統一的なインターフェースを提供します：

* **一時停止中のワークフロー**：一時停止したワークフローのシリアライズ済み状態（後で再開できるようにするため）
* **メモリ**：アプリケーション内の `resourceId` ごとのスレッドとメッセージ
* **トレース**：Mastra のすべてのコンポーネントからの OpenTelemetry トレース
* **評価データセット**：評価実行からのスコアとスコア理由

<br />

<br />

<StorageOverviewImage />

Mastra は複数のストレージプロバイダーを提供しており、相互に置き換えて扱えます。たとえば、開発では libsql を、本番では Postgres を使用しても、いずれの場合もコードは同じように動作します。

## 設定 \{#configuration\}

Mastra では、デフォルトのストレージオプションを指定して設定できます。

```typescript copy
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';

const mastra = new Mastra({
  storage: new LibSQLStore({
    url: 'file:./mastra.db',
  }),
});
```

`storage` 構成を指定しない場合、Mastra はアプリケーションの再起動やデプロイをまたいでデータを保持しません。ローカルでのテストを超えるデプロイでは、`Mastra` 側、または `new Memory()` の中で直接、独自のストレージ構成を用意してください。

## データスキーマ \{#data-schema\}

<Tabs>
  <TabItem value="メッセージ" label="メッセージ">
    会話メッセージとそのメタデータを保存します。各メッセージはスレッドに属し、送信者の役割やメッセージ種別に関するメタデータとともに実際のコンテンツを含みます。

    <br />

    <SchemaTable
      columns={[
{
name: "id",
type: "uuidv4",
description: "メッセージの一意の識別子（形式: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）",
constraints: [
{ type: "primaryKey" },
{ type: "nullable", value: false }
]
},
{
name: "thread_id",
type: "uuidv4",
description: "親スレッドへの参照",
constraints: [
{ type: "foreignKey", value: "threads.id" },
{ type: "nullable", value: false }
]
},
{
name: "resourceId",
type: "uuidv4",
description: "このメッセージの所有元リソースのID",
constraints: [
{ type: "nullable", value: true }
]
},
{
name: "content",
type: "text",
description: "V2形式のメッセージコンテンツのJSON。例: `{ format: 2, parts: [...] }`",
constraints: [{ type: "nullable", value: false }]
},
{
name: "role",
type: "text",
description: "`user | assistant` の列挙型",
constraints: [{ type: "nullable", value: false }]
},
{
name: "createdAt",
type: "timestamp",
description: "スレッド内のメッセージの並び順に使用",
constraints: [{ type: "nullable", value: false }]
}
]}
    />

    メッセージの `content` 列には、AI SDK の `UIMessage` の形に近い設計の `MastraMessageContentV2` 型に準拠する JSON オブジェクトが格納されます。

    <SchemaTable
      columns={[
{
name: "format",
type: "integer",
description: "メッセージ形式のバージョン（現在は 2）",
constraints: [{ type: "nullable", value: false }]
},
{
name: "parts",
type: "array (JSON)",
description: "メッセージパーツの配列（text、tool-invocation、file、reasoning など）。この配列内の各要素の構造は `type` によって異なります。",
constraints: [{ type: "nullable", value: false }]
},
{
name: "experimental_attachments",
type: "array (JSON)",
description: "任意のファイル添付の配列",
constraints: [{ type: "nullable", value: true }]
},
{
name: "content",
type: "text",
description: "メッセージのメインテキスト（任意）",
constraints: [{ type: "nullable", value: true }]
},
{
name: "toolInvocations",
type: "array (JSON)",
description: "ツール呼び出しと結果の要約（任意）の配列",
constraints: [{ type: "nullable", value: true }]
},
{
name: "reasoning",
type: "object (JSON)",
description: "assistant の応答に至る推論プロセスに関する情報（任意）",
constraints: [{ type: "nullable", value: true }]
},
{
name: "annotations",
type: "object (JSON)",
description: "追加のメタデータまたは注釈（任意）",
constraints: [{ type: "nullable", value: true }]
}
]}
    />
  </TabItem>

  <TabItem value="スレッド" label="スレッド">
    関連するメッセージをまとめてリソースに関連付けます。会話に関するメタデータを含みます。

    <br />

    <SchemaTable
      columns={[
{
name: "id",
type: "uuidv4",
description: "スレッドの一意の識別子（形式: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）",
constraints: [
{ type: "primaryKey" },
{ type: "nullable", value: false }
]
},
{
name: "resourceId",
type: "text",
description: "このスレッドが関連付けられている外部リソースの主識別子。関連スレッドのグループ化や取得に使用されます。",
constraints: [{ type: "nullable", value: false }]
},
{
name: "title",
type: "text",
description: "会話スレッドのタイトル",
constraints: [{ type: "nullable", value: false }]
},
{
name: "metadata",
type: "text",
description: "JSON 文字列としてのカスタムスレッドメタデータ。例:",
example: {
category: "support",
priority: 1
}
},
{
name: "createdAt",
type: "timestamp",
constraints: [{ type: "nullable", value: false }]
},
{
name: "updatedAt",
type: "timestamp",
description: "スレッドの並び順履歴に使用",
constraints: [{ type: "nullable", value: false }]
}
]}
    />
  </TabItem>

  <TabItem value="リソース" label="リソース">
    ユーザー固有データをリソーススコープのワーキングメモリとして保存します。各リソースはユーザーまたはエンティティを表し、そのユーザーのすべての会話スレッド間でワーキングメモリを永続化できます。

    <br />

    <SchemaTable
      columns={[
{
name: "id",
type: "text",
description: "リソース識別子（ユーザーまたはエンティティのID）— スレッドやエージェント呼び出しで使用されるresourceIdと同一",
constraints: [
{ type: "primaryKey" },
{ type: "nullable", value: false }
]
},
{
name: "workingMemory",
type: "text",
description: "Markdownテキストとして保存される永続的なワーキングメモリデータ。ユーザープロフィール、嗜好、会話スレッドをまたいで保持されるコンテキスト情報を含みます。",
constraints: [{ type: "nullable", value: true }]
},
{
name: "metadata",
type: "jsonb",
description: "JSON形式の追加リソースメタデータ。例:",
example: {
preferences: { language: "en", timezone: "UTC" },
tags: ["premium", "beta-user"]
},
constraints: [{ type: "nullable", value: true }]
},
{
name: "createdAt",
type: "timestamp",
description: "リソースレコードが最初に作成された時刻",
constraints: [{ type: "nullable", value: false }]
},
{
name: "updatedAt",
type: "timestamp",
description: "ワーキングメモリが最後に更新された時刻",
constraints: [{ type: "nullable", value: false }]
}
]}
    />

    **注**: このテーブルは、リソーススコープのワーキングメモリをサポートするストレージアダプタ（LibSQL、PostgreSQL、Upstash）のみが作成・使用します。その他のストレージアダプタでは、リソーススコープのメモリを使用しようとした場合に、わかりやすいエラーメッセージが返されます。
  </TabItem>

  <TabItem value="ワークフロー" label="ワークフロー">
    ワークフローで `suspend` が呼び出されると、状態は次の形式で保存されます。`resume` が呼び出されると、その状態が復元されます。

    <br />

    <SchemaTable
      columns={[
{
name: "workflow_name",
type: "text",
description: "ワークフロー名",
constraints: [{ type: "nullable", value: false }]
},
{
name: "run_id",
type: "uuidv4",
description: "ワークフロー実行の一意の識別子。suspend/resume の各サイクルをまたいで状態を追跡するために使用（形式: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）",
constraints: [{ type: "nullable", value: false }]
},
{
name: "snapshot",
type: "text",
description: "ワークフローの状態を JSON としてシリアライズしたもの。例:",
example: {
value: { currentState: 'running' },
context: {
  stepResults: {},
  attempts: {},
  triggerData: {}
},
activePaths: [],
runId: '550e8400-e29b-41d4-a716-446655440000',
timestamp: 1648176000000
},
constraints: [{ type: "nullable", value: false }]
},
{
name: "createdAt",
type: "timestamp",
constraints: [{ type: "nullable", value: false }]
},
{
name: "updatedAt",
type: "timestamp",
description: "最終更新時刻。ワークフロー実行中の状態変更を追跡するために使用",
constraints: [{ type: "nullable", value: false }]
}
]}
    />
  </TabItem>

  <TabItem value="評価用データセット" label="評価データセット">
    エージェントの出力に対してメトリクスを実行して得られた評価結果を保存します。

    <br />

    <SchemaTable
      columns={[
{
name: "input",
type: "text",
description: "エージェントに与えた入力",
constraints: [{ type: "nullable", value: false }]
},
{
name: "output",
type: "text",
description: "エージェントが生成した出力",
constraints: [{ type: "nullable", value: false }]
},
{
name: "result",
type: "jsonb",
description: "スコアと詳細を含む評価結果データ。例:",
example: {
score: 0.95,
details: {
  reason: "応答が元の資料を正確に反映している",
  citations: ["page 1", "page 3"]
}
},
constraints: [{ type: "nullable", value: false }]
},
{
name: "agent_name",
type: "text",
constraints: [{ type: "nullable", value: false }]
},
{
name: "metric_name",
type: "text",
description: "例: Faithfulness、Hallucination など",
constraints: [{ type: "nullable", value: false }]
},
{
name: "instructions",
type: "text",
description: "エージェントへのシステムプロンプトまたは指示",
constraints: [{ type: "nullable", value: false }]
},
{
name: "test_info",
type: "jsonb",
description: "追加のテスト用メタデータおよび設定",
constraints: [{ type: "nullable", value: false }]
},
{
name: "global_run_id",
type: "uuidv4",
description: "関連する評価実行をグルーピング（例: CI 実行内のすべてのユニットテスト）",
constraints: [{ type: "nullable", value: false }]
},
{
name: "run_id",
type: "uuidv4",
description: "評価対象の実行の一意の識別子（形式: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）",
constraints: [{ type: "nullable", value: false }]
},
{
name: "created_at",
type: "timestamp",
constraints: [{ type: "nullable", value: false }]
}
]}
    />
  </TabItem>

  <TabItem value="monitoring と de 向けの OpenTelemetry トレースをキャプチャ" label="監視とデバッグのために OpenTelemetry のトレースを取得します">
    監視とデバッグのために OpenTelemetry のトレースを収集します。

    <br />

    <SchemaTable
      columns={[
{
name: "id",
type: "text",
description: "一意のトレース識別子",
constraints: [
{ type: "nullable", value: false },
{ type: "primaryKey" }
]
},
{
name: "parentSpanId",
type: "text",
description: "親スパンの ID。トップレベルのスパンの場合は null",
},
{
name: "name",
type: "text",
description: "階層的なオペレーション名（例: `workflow.myWorkflow.execute`、`http.request`、`database.query`）",
constraints: [{ type: "nullable", value: false }],
},
{
name: "traceId",
type: "text",
description: "関連するスパンをまとめるルートトレース識別子",
constraints: [{ type: "nullable", value: false }]
},
{
name: "scope",
type: "text",
description: "スパンを生成したライブラリ/パッケージ/サービス（例: `@mastra/core`、`express`、`pg`）",
constraints: [{ type: "nullable", value: false }]
},
{
name: "kind",
type: "integer",
description: "`INTERNAL`（0・プロセス内）、`CLIENT`（1・外向き呼び出し）、`SERVER`（2・内向き呼び出し）、`PRODUCER`（3・非同期ジョブの作成）、`CONSUMER`（4・非同期ジョブの処理）",
constraints: [{ type: "nullable", value: false }]
},
{
name: "attributes",
type: "jsonb",
description: "スパンのメタデータを含むユーザー定義のキーと値のペア",
},
{
name: "status",
type: "jsonb",
description: "`code`（UNSET=0、ERROR=1、OK=2）と任意の`message`を持つ JSON オブジェクト。例:",
example: {
code: 1,
message: "HTTP request failed with status 500"
}
},
{
name: "events",
type: "jsonb",
description: "スパン中に発生したタイムスタンプ付きイベント",
},
{
name: "links",
type: "jsonb",
description: "他の関連スパンへのリンク",
},
{
name: "other",
type: "text",
description: "追加の OpenTelemetry スパンフィールド（文字列化した JSON）。例:",
example: {
droppedAttributesCount: 2,
droppedEventsCount: 1,
instrumentationLibrary: "@opentelemetry/instrumentation-http"
}
},
{
name: "startTime",
type: "bigint",
description: "スパン開始時点の Unix エポックからの経過ナノ秒",
constraints: [{ type: "nullable", value: false }]
},
{
name: "endTime",
type: "bigint",
description: "スパン終了時点の Unix エポックからの経過ナノ秒",
constraints: [{ type: "nullable", value: false }]
},
{
name: "createdAt",
type: "timestamp",
constraints: [{ type: "nullable", value: false }]
}
]}
    />
  </TabItem>
</Tabs>

### メッセージのクエリ \{#querying-messages\}

メッセージは内部的に V2 形式で保存されており、概ね AI SDK の `UIMessage` 形式に相当します。`getMessages` でメッセージを取得する際は、出力形式を指定できます。後方互換性のため、デフォルトは `v1` です。

```typescript copy
// 既定の V1 形式でメッセージを取得します（AI SDK の CoreMessage 形式に概ね相当）
const messagesV1 = await mastra.getStorage().getMessages({ threadId: 'your-thread-id' });

// V2 形式でメッセージを取得します（AI SDK の UIMessage 形式に概ね相当）
const messagesV2 = await mastra.getStorage().getMessages({ threadId: 'your-thread-id', format: 'v2' });
```

メッセージIDの配列を使ってメッセージを取得することもできます。`getMessages` と異なり、こちらはデフォルトで V2 形式です。

```typescript copy
const messagesV1 = await mastra.getStorage().getMessagesById({ messageIds: messageIdArr, format: 'v1' });

const messagesV2 = await mastra.getStorage().getMessagesById({ messageIds: messageIdArr });
```

## ストレージプロバイダー \{#storage-providers\}

Mastra は以下のプロバイダーをサポートしています：

* ローカル開発には [LibSQL Storage](/docs/reference/storage/libsql) をご覧ください
* 本番環境には [PostgreSQL Storage](/docs/reference/storage/postgresql) をご覧ください
* サーバーレス環境でのデプロイには [Upstash Storage](/docs/reference/storage/upstash) をご覧ください