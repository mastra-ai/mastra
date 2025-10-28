---
title: "Cloudflare"
description: "Mastra CloudflareDeployer を使って、Mastra アプリケーションを Cloudflare にデプロイする方法を学ぶ"
sidebar_position: 2
---

# CloudflareDeployer \{#cloudflaredeployer\}

`CloudflareDeployer` クラスは、スタンドアロンの Mastra アプリケーションを Cloudflare Workers にデプロイします。設定やデプロイの管理を行い、Cloudflare 固有の機能でベースの [Deployer](/docs/reference/deployer) クラスを拡張します。

## インストール \{#installation\}

```bash copy
npm install @mastra/deployer-cloudflare@latest
```

## 使用例 \{#usage-example\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

export const mastra = new Mastra({
  // ...
  deployer: new CloudflareDeployer({
    projectName: 'hello-mastra',
    env: {
      NODE_ENV: 'production',
    },
  }),
});
```

> 利用可能なすべての設定オプションについては、[CloudflareDeployer](/docs/reference/deployer/cloudflare) の API リファレンスを参照してください。

## 手動デプロイ \{#manual-deployment\}

[Cloudflare Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) を使用して、手動でデプロイすることもできます。Wrangler CLI をインストールしたら、プロジェクトのルートで次のコマンドを実行してアプリケーションをデプロイします。

Wrangler CLI をインストールしたら、Cloudflare アカウントでログインして認証します:

```bash copy
npx wrangler login
```

Cloudflare にアプリケーションをビルドしてデプロイするには、次を実行します

```bash copy
npm run build && wrangler deploy --config .mastra/output/wrangler.json
```

> プロジェクトのルートで `wrangler dev --config .mastra/output/wrangler.json` を実行して、Mastra アプリをローカルでテストすることもできます。

## ビルド出力 \{#build-output\}

`CloudflareDeployer` を使用する Mastra アプリケーションのビルド出力には、プロジェクト内のすべてのエージェント、ツール、ワークフローに加え、Cloudflare 上でアプリケーションを実行するために必要な Mastra 固有のファイルが含まれます。

> ファイル構造の情報が利用可能です。詳しいツリービューは元のドキュメントをご確認ください。

`CloudflareDeployer` は、以下の設定を持つ `wrangler.json` 設定ファイルを `.mastra/output` に自動生成します:

```json
{
  "name": "hello-mastra",
  "main": "./index.mjs",
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat", "nodejs_compat_populate_process_env"],
  "observability": { "logs": { "enabled": true } },
  "vars": {
    "OPENAI_API_KEY": "...",
    "CLOUDFLARE_API_TOKEN": "..."
  }
}
```

## 次のステップ \{#next-steps\}

* [Mastra クライアント SDK](/docs/reference/client-js/mastra-client)