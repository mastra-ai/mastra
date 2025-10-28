---
title: "Cloudflare デプロイアー"
description: "Mastra アプリケーションを Cloudflare Workers にデプロイする CloudflareDeployer クラスのドキュメント。"
---

# CloudflareDeployer \{#cloudflaredeployer\}

`CloudflareDeployer` クラスは、スタンドアロンの Mastra アプリケーションを Cloudflare Workers にデプロイする役割を担います。設定やデプロイの管理を行い、Cloudflare 固有の機能を追加してベースの [Deployer](/docs/reference/deployer) クラスを拡張します。

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from "@mastra/core/mastra";
import { CloudflareDeployer } from "@mastra/deployer-cloudflare";

export const mastra = new Mastra({
  // ...
  deployer: new CloudflareDeployer({
    projectName: "hello-mastra",
    routes: [
      {
        pattern: "example.com/*",
        zone_name: "example.com",
        custom_domain: true
      }
    ],
    workerNamespace: "my-namespace",
    env: {
      NODE_ENV: "production",
      API_KEY: "<api-key>"
    },
    d1Databases: [
      {
        binding: "DB",
        database_name: "my-database",
        database_id: "d1-database-id",
        preview_database_id: "your-preview-database-id"
      }
    ],
    kvNamespaces: [
      {
        binding: "CACHE",
        id: "kv-namespace-id"
      }
    ]
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "projectName",
type: "string",
description: "ワーカープロジェクトの名前。",
isOptional: true,
defaultValue: "'mastra'",
},
{
name: "routes",
type: "CFRoute[]",
description: "ワーカーのルート設定の配列。各ルートには次が必要です: pattern（string）、zone_name（string）、custom_domain（boolean、任意）。",
isOptional: true,
},
{
name: "workerNamespace",
type: "string",
description: "ワーカーの名前空間。",
isOptional: true,
},
{
name: "env",
type: "Record<string, any>",
description: "ワーカー設定に含める環境変数。",
isOptional: true,
},
{
name: "d1Databases",
type: "D1DatabaseBinding[]",
description: "D1 データベースバインディングの配列。各バインディングには次が必要です: binding（string）、database_name（string）、database_id（string）、preview_database_id（string、任意）。",
isOptional: true,
},
{
name: "kvNamespaces",
type: "KVNamespaceBinding[]",
description: "KV 名前空間バインディングの配列。各バインディングには次が必要です: binding（string）、id（string）。",
isOptional: true,
},
]}
/>