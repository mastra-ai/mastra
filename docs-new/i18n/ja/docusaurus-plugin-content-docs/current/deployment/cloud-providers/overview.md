---
title: "概要"
description: "Mastra アプリケーションを主要なクラウドプロバイダーにデプロイする。"
sidebar_position: 1
---

## クラウドプロバイダー \{#cloud-providers\}

スタンドアロンの Mastra アプリケーションは主要なクラウドプロバイダーにデプロイできます。詳しくは次のガイドをご覧ください。

* [Amazon EC2](/docs/deployment/cloud-providers/amazon-ec2)
* [AWS Lambda](/docs/deployment/cloud-providers/aws-lambda)
* [Digital Ocean](/docs/deployment/cloud-providers/digital-ocean)
* [Azure App Services](/docs/deployment/cloud-providers/azure-app-services)

自己ホストの Node.js サーバーへのデプロイについては、[Mastra サーバーの作成](/docs/deployment/server-deployment) ガイドをご参照ください。

## 前提条件 \{#prerequisites\}

クラウドプロバイダーにデプロイする前に、次を用意してください:

* [Mastra アプリケーション](/docs/getting-started/installation)
* Node.js `v20.0` 以上
* アプリケーション用の GitHub リポジトリ（多くの CI/CD 構成で必須）
* ドメイン名の管理権限（SSL および HTTPS 用）
* サーバーの基本的な運用知識（例: Nginx、環境変数）

## LibSQLStore \{#libsqlstore\}

`LibSQLStore` はローカルファイルシステムに書き込みますが、エフェメラル（短命）なファイルシステムを使用するクラウド環境ではサポートされません。**AWS Lambda**、**Azure App Services**、**Digital Ocean App Platform** などのプラットフォームへデプロイする場合は、`LibSQLStore` の使用をすべて**削除する必要があります**。

具体的には、`src/mastra/index.ts` と `src/mastra/agents/weather-agent.ts` の両方から削除していることを確認してください:

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
