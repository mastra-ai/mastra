---
title: "Mastra.getServer() "
description: "Mastra の `Mastra.getServer()` メソッドのドキュメント。設定されたサーバー設定を取得します。"
---

# Mastra.getServer() \{#mastragetserver\}

`.getServer()` メソッドは、Mastra インスタンスで構成済みのサーバー設定を取得するために使用します。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getServer();
```

## パラメータ \{#parameters\}

このメソッドはパラメータを受け取りません。

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "server",
type: "ServerConfig | undefined",
description: "ポート、タイムアウト、API ルート、ミドルウェア、CORS 設定、ビルドオプションなどを含むサーバーの構成設定。サーバーが構成されていない場合は undefined。",
},
]}
/>

## 関連 \{#related\}

* [サーバーのデプロイ](/docs/deployment/server-deployment)
* [サーバーの構成](/docs/server-db/custom-api-routes)