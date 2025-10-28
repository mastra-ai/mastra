---
title: "MCPServer のデプロイ"
description: stdio トランスポートを使って Mastra MCPServer をセットアップ、ビルド、デプロイし、npm に公開する手順例。
---

# 例: MCPServer のデプロイ \{#example-deploying-an-mcpserver\}

この例では、stdio トランスポートを用いて基本的な Mastra MCPServer をセットアップし、ビルドして、NPM への公開などのデプロイ準備を行う方法を説明します。

## 依存関係のインストール \{#install-dependencies\}

必要なパッケージをインストールします：

```bash
pnpm add @mastra/mcp @mastra/core tsup
```

## MCP サーバーをセットアップする \{#set-up-mcp-server\}

1. 例として、stdio サーバー用のファイルを `/src/mastra/stdio.ts` に作成します。

2. 次のコードをファイルに追加します。実際の Mastra のツールをインポートし、サーバー名を適切に設定することを忘れないでください。

   ```typescript filename="src/mastra/stdio.ts" copy
   #!/usr/bin/env node
   import { MCPServer } from '@mastra/mcp';
   import { weatherTool } from './tools';

   const server = new MCPServer({
     name: 'my-mcp-server',
     version: '1.0.0',
     tools: { weatherTool },
   });

   server.startStdio().catch(error => {
     console.error('Error running MCP server:', error);
     process.exit(1);
   });
   ```

3. `package.json` を更新し、ビルド後のサーバーファイルを指す `bin` エントリと、サーバーをビルドするためのスクリプトを追加します。

```json filename="package.json" copy
{
  "bin": "dist/stdio.js",
  "scripts": {
    "build:mcp": "tsup src/mastra/stdio.ts --format esm --no-splitting --dts && chmod +x dist/stdio.js"
  }
}
```

4. ビルドコマンドを実行します：

   ```bash
   pnpm run build:mcp
   ```

   これによりサーバーコードがコンパイルされ、出力ファイルが実行可能になります。

## NPM へのデプロイ \{#deploying-to-npm\}

`npx` での実行や依存パッケージとして他の人（または自分）にあなたの MCP サーバーを使ってもらえるようにするには、NPM に公開します。

1. NPM アカウントを作成し、ログインしていることを確認します（`npm login`）。
2. `package.json` の `name` が一意で、未使用であることを確認します。
3. ビルド後、プロジェクトのルートで次の公開コマンドを実行します:

   ```bash
   npm publish --access public
   ```

   パッケージの公開の詳細は、[NPM ドキュメント](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages)を参照してください。

## デプロイ済みのMCPサーバーを使用する \{#use-the-deployed-mcp-server\}

公開後は、パッケージを実行するコマンドを指定することで、`MCPClient` からMCPサーバーを利用できます。Claude Desktop、Cursor、Windsurf など、ほかのMCPクライアントからも利用可能です。

```typescript
import { MCPClient } from '@mastra/mcp';

const mcp = new MCPClient({
  servers: {
    // この MCP サーバーのインスタンスに名前を付ける
    yourServerName: {
      command: 'npx',
      args: ['-y', '@your-org-name/your-package-name@latest'], // あなたのパッケージ名に置き換えてください
    },
  },
});

// この構成からツールやツールセットを取得して、エージェントで使用できます
const tools = await mcp.getTools();
const toolsets = await mcp.getToolsets();
```

Note: 組織スコープを付けずに公開した場合、`args` は単に `["-y", "your-package-name@latest"]` になることがあります。

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />
