---
title: "Mastra.getVector() "
description: "Mastra の `Mastra.getVector()` メソッドのドキュメント。名前を指定してベクターストアを取得します。"
---

# Mastra.getVector() \{#mastragetvector\}

`.getVector()` メソッドは、名前を指定してベクターストアを取得します。引数には、ベクターストア名を表す `string` 型の値を1つ取ります。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getVector('testVectorStore');
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "name",
type: "TVectorName extends keyof TVectors",
description: "取得するベクターストアの名前。Mastra の設定内に存在する有効なベクターストア名である必要があります。",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "vector",
type: "TVectors[TVectorName]",
description: "指定された名前のベクトルストアのインスタンス。ベクトルストアが見つからない場合はエラーをスローします。",
},
]}
/>

## 関連項目 \{#related\}

* [ベクターストアの概要](/docs/rag/vector-databases)
* [RAGの概要](/docs/rag/overview)