---
title: "Netlify デプロイヤー"
description: "Mastra アプリケーションを Netlify Functions にデプロイする NetlifyDeployer クラスのドキュメント。"
---

# NetlifyDeployer \{#netlifydeployer\}

`NetlifyDeployer` クラスは、スタンドアロンの Mastra アプリケーションを Netlify にデプロイする役割を担います。設定やデプロイを管理し、Netlify 固有の機能を備えてベースの [Deployer](/docs/reference/deployer) クラスを拡張します。

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { NetlifyDeployer } from '@mastra/deployer-netlify';

export const mastra = new Mastra({
  // ...
  deployer: new NetlifyDeployer(),
});
```
