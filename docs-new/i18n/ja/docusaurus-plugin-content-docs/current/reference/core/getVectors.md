---
title: "Mastra.getVectors()"
description: "Mastra の `Mastra.getVectors()` メソッドのドキュメント。構成済みのすべてのベクターストアを取得します。"
---

# Mastra.getVectors() \{#mastragetvectors\}

`.getVectors()` メソッドは、Mastra インスタンスで構成されているすべてのベクターストアを取得するために使用します。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getVectors();
```

## パラメーター \{#parameters\}

このメソッドはパラメーターを受け取りません。

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "vectors",
type: "TVectors",
description: "設定されているすべてのベクターストアのレコード。キーはベクターストア名、値はベクターストアのインスタンスです。",
},
]}
/>

## 関連情報 \{#related\}

* [ベクター ストアの概要](/docs/rag/vector-databases)
* [RAGの概要](/docs/rag/overview)