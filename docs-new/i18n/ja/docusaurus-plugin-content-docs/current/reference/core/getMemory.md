---
title: "Mastra.getMemory() "
description: "Mastra の `Mastra.getMemory()` メソッドのドキュメント。構成済みのメモリインスタンスを取得します。"
---

# Mastra.getMemory() \{#mastragetmemory\}

`.getMemory()` メソッドは、Mastra インスタンスで構成されたメモリインスタンスを取得するために使用します。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getMemory();
```

## パラメータ \{#parameters\}

このメソッドはパラメータを受け取りません。

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "memory",
type: "MastraMemory | undefined",
description: "構成済みのメモリ インスタンス。メモリが構成されていない場合は undefined。",
},
]}
/>

## 関連項目 \{#related\}

* [Memory 概要](/docs/memory/overview)
* [Memory リファレンス](/docs/reference/memory)