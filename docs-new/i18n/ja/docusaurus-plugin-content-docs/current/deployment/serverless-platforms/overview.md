---
title: "概要"
description: "プラットフォーム固有のデプロイヤーまたは標準の HTTP サーバーを使用して、Mastra アプリケーションを構築・デプロイする"
sidebar_position: 1
---

# サーバーレスへのデプロイ \{#serverless-deployment\}

スタンドアロンの Mastra アプリは、以下のデプロイヤーパッケージのいずれかを使って主要なサーバーレスプラットフォームへデプロイできます：

* [Cloudflare](/docs/deployment/serverless-platforms/cloudflare-deployer)
* [Netlify](/docs/deployment/serverless-platforms/netlify-deployer)
* [Vercel](/docs/deployment/serverless-platforms/vercel-deployer)

フレームワークに Mastra を統合する場合、デプロイヤーは不要です。詳しくは [Web Framework Integration](/docs/deployment/web-framework) をご覧ください。

自己ホストの Node.js サーバーにデプロイする場合は、[Creating A Mastra Server](/docs/deployment/server-deployment) ガイドをご参照ください。

## 前提条件 \{#prerequisites\}

開始する前に、次の準備ができていることを確認してください：

* Node.js `v20.0` 以上
* プラットフォーム固有のデプロイツールを使用する場合：
  * 選択したプラットフォームのアカウント
  * 必要な API キーまたは認証情報

## LibSQLStore \{#libsqlstore\}

`LibSQLStore` はローカルファイルシステムに書き込みますが、サーバーレス環境は性質上エフェメラルであるため、そこでの利用はサポートされていません。Vercel、Netlify、Cloudflare のようなプラットフォームにデプロイする場合は、`LibSQLStore` の使用を必ずすべて削除してください。

具体的には、`src/mastra/index.ts` と `src/mastra/agents/weather-agent.ts` の両方から削除していることを確認してください。

```typescript filename="src/mastra/index.ts" showLineNumbers
export const mastra = new Mastra({
  // ...
  storage: new LibSQLStore({
    // [!code --]
    // テレメトリ、評価などをメモリストレージに保存します。永続化する場合は file:../mastra.db に変更してください // [!code --]
    url: ':memory:', // [!code --]
  }), //[!code --]
});
```

```typescript filename="src/mastra/agents/weather-agent.ts" showLineNumbers
export const weatherAgent = new Agent({
  // ..
  memory: new Memory({
    // [!code --]
    storage: new LibSQLStore({
      // [!code --]
      url: 'file:../mastra.db', // パスは .mastra/output ディレクトリを基準とした相対パスです // [!code --]
    }), // [!code --]
  }), //  [!code --]
});
```
