---
title: "Vercel デプロイヤー"
description: "Mastra アプリケーションを Vercel にデプロイする VercelDeployer クラスのドキュメント"
---

# VercelDeployer \{#verceldeployer\}

`VercelDeployer` クラスは、スタンドアロンの Mastra アプリケーションを Vercel へデプロイするためのクラスです。設定やデプロイを管理し、Vercel 固有の機能を追加して基底の [Deployer](/docs/reference/deployer) クラスを拡張します。

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { VercelDeployer } from '@mastra/deployer-vercel';

export const mastra = new Mastra({
  // ...
  deployer: new VercelDeployer(),
});
```

## コンストラクターのオプション \{#constructor-options\}

デプロイヤーは、Vercel Output API の関数設定（`.vc-config.json`）に書き込まれる少数の重要なオーバーライドをサポートします:

* `maxDuration?: number` — 関数の実行タイムアウト（秒）
* `memory?: number` — 関数のメモリ（MB）
* `regions?: string[]` — 関数をデプロイするリージョン（例: `['sfo1','iad1']`）

これらのオプションは、デフォルトのフィールド（`handler`、`launcherType`、`runtime`、`shouldAddHelpers`）を保持したまま、`.vercel/output/functions/index.func/.vc-config.json` にマージされます。

### オーバーライドを用いた例 \{#example-with-overrides\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { VercelDeployer } from '@mastra/deployer-vercel';

export const mastra = new Mastra({
  // ...
  deployer: new VercelDeployer({
    maxDuration: 600,
    memory: 1536,
    regions: ['sfo1', 'iad1'],
  }),
});
```
