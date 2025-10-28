---
title: "本番サーバー"
description: "API や CORS などのカスタム設定で、本番環境向けの Mastra サーバーを構成・デプロイする方法を学びます"
sidebar_position: 1
---

# Mastra の本番サーバーを作成する \{#create-a-mastra-production-server\}

Mastra アプリケーションを本番環境にデプロイすると、HTTP サーバーとして動作し、エージェントやワークフロー、そのほかの機能を API エンドポイントとして公開します。ここでは、本番環境向けにサーバーを設定・カスタマイズする方法を説明します。

## サーバーアーキテクチャ \{#server-architecture\}

Mastra は基盤となる HTTP サーバーフレームワークとして [Hono](https://hono.dev) を使用しています。`mastra build` で Mastra アプリケーションをビルドすると、`.mastra` ディレクトリに Hono ベースの HTTP サーバーが生成されます。

このサーバーでは次の機能を提供します:

* 登録済みのすべてのエージェント向け API エンドポイント
* 登録済みのすべてのワークフロー向け API エンドポイント
* カスタム API ルートのサポート
* カスタムミドルウェアのサポート
* タイムアウトの設定
* ポートの設定
* ボディサイズ上限の設定

追加のサーバー機能の拡張方法については、[Middleware](/docs/server-db/middleware) および
[Custom API Routes](/docs/server-db/custom-api-routes) のページをご覧ください。

## サーバー設定 \{#server-configuration\}

Mastra インスタンスでサーバーの `port` と `timeout` を構成できます。

```typescript filename="src/mastra/index.ts" copy showLineNumbers
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  // ...
  server: {
    port: 3000, // デフォルトは4111
    timeout: 10000, // デフォルトは30000 (30秒)
  },
});
```

`method` オプションには `"GET"`、`"POST"`、`"PUT"`、`"DELETE"`、または `"ALL"` のいずれかを指定できます。`"ALL"` を指定すると、パスに一致する任意の HTTP メソッドでハンドラーが呼び出されます。

## TypeScript の設定 \{#typescript-configuration\}

Mastra では、現行の Node.js に対応した `module` と `moduleResolution` の設定値が必要です。`CommonJS` や `node` などの旧来の設定は Mastra のパッケージと互換性がなく、依存解決エラーの原因になります。

```json {4-5} filename="tsconfig.json" copy
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

> この TypeScript 構成は、最新のモジュール解決と厳格な型チェックを採用し、Mastra プロジェクト向けに最適化されています。

## CORS 設定 \{#cors-configuration\}

Mastra では、サーバーの CORS（クロスオリジンリソース共有）設定を設定できます。

```typescript filename="src/mastra/index.ts" copy showLineNumbers
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  // ...
  server: {
    cors: {
      origin: ['https://example.com'], // 特定のオリジンを許可、または '*' ですべてを許可
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: false,
    },
  },
});
```
