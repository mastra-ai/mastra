---
title: Webフレームワークとともに
description: "Mastra を Web フレームワークに統合してデプロイする方法を学ぶ"
sidebar_position: 4
---

# Webフレームワーク統合 \{#web-framework-integration\}

このガイドでは、Mastra を統合したアプリケーションのデプロイ方法を説明します。Mastra はさまざまな Web フレームワークに統合でき、詳しくは以下のガイドをご覧ください。

* [Next.js と一緒に使う](/docs/frameworks/web-frameworks/next-js)
* [Astro と一緒に使う](/docs/frameworks/web-frameworks/astro)

フレームワークに統合している場合、Mastra は通常、デプロイ時に追加の設定は不要です。

## Vercel 上での Next.js の利用 \{#with-nextjs-on-vercel\}

[ガイド](/docs/frameworks/web-frameworks/next-js)に従って Mastra を Next.js に統合し、Vercel へデプロイする予定であれば、追加の設定は不要です。

確認すべき唯一の点は、サーバーレス環境ではサポートされない [LibSQLStore](/docs/reference/storage/libsql) の使用を削除し、`next.config.ts` に以下を追加していることです。

```typescript {4} filename="next.config.ts" showLineNumbers copy
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@mastra/*'],
};

export default nextConfig;
```

## Vercel での Astro 利用 \{#with-astro-on-vercel\}

Mastra を Astro に[ガイドに従って](/docs/frameworks/web-frameworks/astro)統合し、Vercel にデプロイする予定であれば、追加のセットアップは不要です。

確認すべき点はただひとつ、`astro.config.mjs` に以下を追加し、サーバーレス環境ではサポートされていない [LibSQLStore](/docs/reference/storage/libsql) の使用を削除していることです。

```javascript {2,6,7} filename="astro.config.mjs" showLineNumbers copy
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // ...
  adapter: vercel(),
  output: 'server',
});
```

## Netlify 上での Astro の利用 \{#with-astro-on-netlify\}

Mastra を Astro と[ガイドに従って](/docs/frameworks/web-frameworks/astro)統合し、Vercel にデプロイする予定であれば、追加のセットアップは不要です。

確認すべき点は、`astro.config.mjs` に以下を追加していることと、サーバーレス環境ではサポートされない [LibSQLStore](/docs/reference/storage/libsql) の使用をすべて削除していることの2点だけです。

```javascript {2,6,7} filename="astro.config.mjs" showLineNumbers copy
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/netlify';

export default defineConfig({
  // ...
  adapter: netlify(),
  output: 'server',
});
```
