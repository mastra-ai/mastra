---
title: "Mastra.setStorage() "
description: "Mastra の `Mastra.setStorage()` メソッドに関するドキュメント。Mastra インスタンスにストレージインスタンスを設定します。"
---

# Mastra.setStorage() \{#mastrasetstorage\}

`.setStorage()` メソッドは、Mastra インスタンスに使用するストレージインスタンスを設定します。このメソッドは `MastraStorage` を1つだけ受け取ります。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.setStorage(
  new LibSQLStore({
    url: ':memory:',
  }),
);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "storage",
type: "MastraStorage",
description: "Mastra インスタンスに設定するストレージ インスタンス。",
},
]}
/>

## 戻り値 \{#returns\}

このメソッドは値を返しません。

## 関連項目 \{#related\}

* [ストレージ概要](/docs/server-db/storage)
* [ストレージリファレンス](/docs/reference/storage/libsql)