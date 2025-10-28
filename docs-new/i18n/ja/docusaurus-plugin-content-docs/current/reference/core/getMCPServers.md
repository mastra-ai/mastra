---
title: "Mastra.getMCPServers() "
description: "Mastra の `Mastra.getMCPServers()` メソッドのドキュメント。登録されているすべての MCP サーバーインスタンスを取得します。"
---

# Mastra.getMCPServers() \{#mastragetmcpservers\}

`.getMCPServers()` メソッドは、Mastra インスタンスに登録されているすべての MCP サーバー インスタンスを取得するために使用します。

## 使用例 \{#usage-example\}

```typescript copy
mastra.getMCPServers();
```

## パラメータ \{#parameters\}

このメソッドはパラメータを受け取りません。

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "servers",
type: "Record<string, MCPServerBase> | undefined",
description: "登録されているすべての MCP サーバーインスタンスを格納したレコード。キーはサーバー ID、値は MCPServerBase のインスタンス。サーバーが登録されていない場合は undefined。",
},
]}
/>

## 関連項目 \{#related\}

* [MCP の概要](/docs/tools-mcp/mcp-overview)
* [MCP サーバー リファレンス](/docs/reference/tools/mcp-server)