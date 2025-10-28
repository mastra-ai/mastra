---
title: "Vercel"
description: "Mastra VercelDeployer を使って Mastra アプリケーションを Vercel にデプロイする方法を学ぶ"
---

# VercelDeployer \{#verceldeployer\}

`VercelDeployer` クラスは、スタンドアロンの Mastra アプリケーションを Vercel にデプロイする役割を担います。設定やデプロイを管理し、Vercel 固有の機能でベースの [Deployer](/docs/reference/deployer) クラスを拡張します。

## インストール \{#installation\}

```bash copy
npm install @mastra/deployer-vercel@latest
```

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { VercelDeployer } from '@mastra/deployer-vercel';

export const mastra = new Mastra({
  // ...
  deployer: new VercelDeployer(),
});
```

> 利用可能なすべての設定オプションについては、[VercelDeployer](/docs/reference/deployer/vercel) の API リファレンスをご覧ください。

### 任意のオーバーライド \{#optional-overrides\}

Vercel のデプロイヤーは、いくつかの重要な設定を Vercel Output API の関数設定（`.vc-config.json`）に書き込むことができます：

* `maxDuration?: number` — 関数の実行タイムアウト（秒）
* `memory?: number` — 関数のメモリ割り当て（MB）
* `regions?: string[]` — リージョン（例：`['sfo1','iad1']`）

例：

```ts filename="src/mastra/index.ts" showLineNumbers copy
deployer: new VercelDeployer({
  maxDuration: 600,
  memory: 1536,
  regions: ['sfo1', 'iad1'],
});
```

## 継続的インテグレーション \{#continuous-integration\}

Mastra プロジェクトの Git リポジトリを Vercel に接続したら、プロジェクト設定を更新します。Vercel ダッシュボードで **Settings** &gt; **Build and Deployment** に移動し、**Framework settings** で次のように設定します。

* **Build command**: `npm run build`（任意）

### 環境変数 \{#environment-variables\}

初回のデプロイ前に、アプリケーションで使用する環境変数を必ず追加してください。たとえば、LLM として OpenAI を使用している場合は、Vercel のプロジェクト設定で `OPENAI_API_KEY` を設定する必要があります。

> 詳細は [Environment variables](https://vercel.com/docs/environment-variables) を参照してください。

これで、GitHub リポジトリの指定ブランチにプッシュするたびに自動デプロイが実行されるようにプロジェクトが構成されました。

## 手動デプロイ \{#manual-deployment\}

[Vercel CLI](https://vercel.com/docs/cli) を使って手動でデプロイすることもできます。Vercel CLI をインストールした状態で、プロジェクトのルートで次を実行してアプリケーションをデプロイします。

```bash copy
npm run build && vercel --prod --prebuilt --archive=tgz
```

> プロジェクトのルートで `vercel dev` を実行すると、Mastra アプリをローカルでテストできます。

## ビルド出力 \{#build-output\}

`VercelDeployer` を使用する Mastra アプリケーションのビルド出力には、プロジェクト内のすべてのエージェント、ツール、ワークフローに加え、Vercel 上でアプリケーションを実行するために必要な Mastra 固有のファイルが含まれます。

> ファイル構造に関する情報は利用可能です。詳細なツリー表示は元のドキュメントを参照してください。

`VercelDeployer` は `.vercel/output` に `config.json` 構成ファイルを自動生成し、以下の設定を含みます:

```json
{
  "version": 3,
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/"
    }
  ]
}
```

## 次の手順 \{#next-steps\}

* [Mastra クライアント SDK](/docs/reference/client-js/mastra-client)