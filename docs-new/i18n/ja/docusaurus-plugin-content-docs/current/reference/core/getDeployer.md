---
title: "Mastra.getDeployer() "
description: "Mastra の `Mastra.getDeployer()` メソッドのドキュメント。設定済みのデプロイヤーインスタンスを取得します。"
---

# Mastra.getDeployer() \{#mastragetdeployer\}

`.getDeployer()` メソッドは、Mastra インスタンスで設定されたデプロイヤーのインスタンスを取得するために使用します。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getDeployer();
```

## パラメータ \{#parameters\}

このメソッドはパラメータを受け取りません。

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "deployer",
type: "MastraDeployer | undefined",
description: "設定されたデプロイヤーインスタンス。デプロイヤーが未設定の場合は undefined です。",
},
]}
/>

## 関連情報 \{#related\}

* [デプロイの概要](/docs/deployment/overview)
* [Deployer リファレンス](/docs/reference/deployer)