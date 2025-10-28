---
title: "Mastra.getMCPServer() "
description: "Mastra の `Mastra.getMCPServer()` メソッドのドキュメント。ID と任意のバージョンを指定して、特定の MCP サーバー インスタンスを取得します。"
---

# Mastra.getMCPServer() \{#mastragetmcpserver\}

`.getMCPServer()` メソッドは、論理 ID と任意指定のバージョンに基づいて特定の MCP サーバーインスタンスを取得します。バージョンが指定されている場合は、その論理 ID とバージョンに完全一致するサーバーを検索します。バージョンが指定されていない場合は、指定した論理 ID を持つサーバーのうち、releaseDate が最も新しいものを返します。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getMCPServer('1.2.0');
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "serverId",
type: "string",
description: "取得する MCP サーバーの論理 ID。MCPServer インスタンスの `id` プロパティと一致している必要があります。",
},
{
name: "version",
type: "string",
description: "取得する MCP サーバーの特定のバージョン（任意）。指定しない場合は、最も新しい releaseDate を持つサーバーを返します。",
optional: true,
},
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "server",
type: "MCPServerBase | undefined",
description: "指定したIDとバージョンに対応するMCPサーバーインスタンス。見つからない場合、またはそのバージョンが見つからない場合は undefined。",
},
]}
/>

## 関連情報 \{#related\}

* [MCP の概要](/docs/tools-mcp/mcp-overview)
* [MCP サーバーリファレンス](/docs/reference/tools/mcp-server)