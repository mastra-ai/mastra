---
title: "Mastra.getStorage() "
description: "Mastra の `Mastra.getStorage()` メソッドのドキュメント。設定済みのストレージインスタンスを取得します。"
---

# Mastra.getStorage() \{#mastragetstorage\}

`.getStorage()` メソッドは、Mastra インスタンスで設定されたストレージ インスタンスを取得するために使用します。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getStorage();
```

## パラメータ \{#parameters\}

このメソッドはパラメータを受け付けません。

## 返却値 \{#returns\}

<PropertiesTable
  content={[
{
name: "storage",
type: "MastraStorage | undefined",
description: "設定済みのストレージインスタンス。ストレージが設定されていない場合は undefined。",
},
]}
/>

## 関連情報 \{#related\}

* [ストレージの概要](/docs/server-db/storage)
* [ストレージ リファレンス](/docs/reference/storage/libsql)