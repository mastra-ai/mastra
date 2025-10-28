---
title: モノレポでの運用
description: モノレポ構成内の Mastra アプリケーションをデプロイする方法を学ぶ
sidebar_position: 3
---

# Monorepo へのデプロイ \{#monorepo-deployment\}

Monorepo での Mastra のデプロイは、スタンドアロンのアプリケーションをデプロイする場合と基本的に同じ方法です。[Cloud](/docs/deployment/cloud-providers/overview) や [Serverless Platform](/docs/deployment/serverless-platforms/overview) の一部のプロバイダーでは追加要件が発生する場合がありますが、基本的なセットアップは変わりません。

## モノレポの例 \{#example-monorepo\}

この例では、Mastra アプリケーションは `apps/api` にあります。

> ファイル構成情報があります。詳細なツリービューは元のドキュメントを参照してください。

## 環境変数 \{#environment-variables\}

`OPENAI_API_KEY` のような環境変数は、Mastra アプリケーションのルート `(apps/api)` にある `.env` ファイルに保存してください。例:

> ファイル構成に関する情報は利用可能です。詳細なツリービューは元のドキュメントをご参照ください。

## デプロイ構成 \{#deployment-configuration\}

下の画像は、[Mastra Cloud](../mastra-cloud/overview) にデプロイする際に、プロジェクトのルートとして `apps/api` を選択する手順を示しています。プロバイダーによってインターフェースは異なる場合がありますが、設定は同一です。

![デプロイ構成](/img/monorepo/monorepo-mastra-cloud.jpg)

## 依存関係の管理 \{#dependency-management\}

モノレポでは、バージョンの衝突やビルドエラーを避けるために依存関係を統一しましょう。

* すべてのパッケージが同じバージョンに解決されるよう、プロジェクトのルートに**単一のロックファイル**を置く。
* 重複を防ぐために、**共有ライブラリ**（Mastra や各種フレームワークなど）のバージョンを揃える。

## デプロイ時の落とし穴 \{#deployment-pitfalls\}

Monorepo で Mastra をデプロイする際に注意すべき一般的な問題:

* **プロジェクトルートの誤り**: 正しいパッケージ（例: `apps/api`）をデプロイ対象として選択していることを確認してください。

## バンドラーのオプション \{#bundler-options\}

`transpilePackages` を使用して、TypeScript のワークスペース内パッケージやライブラリをコンパイルします。各 `package.json` に記載されているとおりのパッケージ名をそのまま列挙してください。実行時に解決される依存関係を除外するには `externals` を、読みやすいスタックトレースを出力するには `sourcemap` を使用します。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  // ...
  bundler: {
    transpilePackages: ['utils'],
    externals: ['ui'],
    sourcemap: true,
  },
});
```

> 追加の設定オプションについては、[Mastra Class](/docs/reference/core/mastra-class) をご覧ください。

## サポート対象のモノレポ \{#supported-monorepos\}

Mastra は次の環境で動作します:

* npm workspaces
* pnpm workspaces
* Yarn workspaces
* Turborepo

既知の制限:

* Bun workspaces — 部分的にサポート、既知の不具合あり
* Nx — Nx の[依存関係戦略（サポート対象）](https://nx.dev/concepts/decisions/dependency-management)は利用できますが、ワークスペース内の各パッケージに `package.json` が必要です

> モノレポで問題が発生している場合は、こちらをご覧ください: [Monorepos Support mega issue](https://github.com/mastra-ai/mastra/issues/6852)。