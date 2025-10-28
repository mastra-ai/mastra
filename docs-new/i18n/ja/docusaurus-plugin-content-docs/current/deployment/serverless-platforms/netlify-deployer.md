---
title: "Netlify"
description: "Mastra NetlifyDeployer を使って Mastra アプリケーションを Netlify にデプロイする方法を学ぶ"
sidebar_position: 3
---

# NetlifyDeployer \{#netlifydeployer\}

`NetlifyDeployer` クラスは、スタンドアロンの Mastra アプリケーションを Netlify にデプロイする役割を担います。設定やデプロイの管理を行い、Netlify 固有の機能を追加して、ベースの [Deployer](/docs/reference/deployer) クラスを拡張します。

## インストール \{#installation\}

```bash copy
npm install @mastra/deployer-netlify@latest
```

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { NetlifyDeployer } from '@mastra/deployer-netlify';

export const mastra = new Mastra({
  // ...
  deployer: new NetlifyDeployer(),
});
```

> 利用可能なすべての設定オプションについては、[NetlifyDeployer](/docs/reference/deployer/netlify) の API リファレンスを参照してください。

## 継続的インテグレーション \{#continuous-integration\}

Mastra プロジェクトの Git リポジトリを Netlify に接続したら、プロジェクト設定を更新します。Netlify のダッシュボードで **Project configuration** &gt; **Build &amp; deploy** &gt; **Continuous deployment** に移動し、**Build settings** の項目で次を設定します:

* **Build command**: `npm run build`（任意）

### 環境変数 \{#environment-variables\}

初回のデプロイ前に、アプリケーションで使用する環境変数を必ず追加してください。たとえば、LLM に OpenAI を使用している場合は、Netlify のプロジェクト設定で `OPENAI_API_KEY` を設定する必要があります。

> 詳細は [Environment variables overview](https://docs.netlify.com/environment-variables/overview/) を参照してください。

これで、GitHub リポジトリの指定ブランチにプッシュするたびに、自動デプロイが実行されるようにプロジェクトが設定されました。

## 手動デプロイ \{#manual-deployment\}

[Netlify CLI](https://docs.netlify.com/cli/get-started/) を使って手動でデプロイすることも可能です。Netlify CLI をインストール後、プロジェクトのルートで次のコマンドを実行してアプリケーションをデプロイしてください。

```bash copy
netlify deploy --prod
```

> プロジェクトのルートで `netlify dev` を実行して、Mastra アプリをローカルでテストすることもできます。

## ビルド出力 \{#build-output\}

`NetlifyDeployer` を使用する Mastra アプリケーションのビルド出力には、プロジェクト内のすべてのエージェント、ツール、ワークフローに加え、Netlify 上でアプリケーションを実行するために必要な Mastra 固有のファイルが含まれます。

> ファイル構造に関する情報は利用可能です。詳細なツリー表示は元のドキュメントをご覧ください。

`NetlifyDeployer` は、以下の設定を含む `config.json` 設定ファイルを `.netlify/v1` に自動生成します:

```json
{
  "redirects": [
    {
      "force": true,
      "from": "/*",
      "to": "/.netlify/functions/api/:splat",
      "status": 200
    }
  ]
}
```

## 次のステップ \{#next-steps\}

* [Mastra クライアント SDK](/docs/reference/client-js/mastra-client)