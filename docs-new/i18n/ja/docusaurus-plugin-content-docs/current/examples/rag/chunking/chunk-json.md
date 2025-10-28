---
title: "JSONのセマンティック分割"
description: MastraでJSONデータを意味に基づいて分割し、ドキュメントをセマンティックにチャンク化します。
---

# JSONを意味的にチャンク化する \{#semantically-chunking-json\}

JSONデータを扱う際は、オブジェクトの構造を保ったまま小さな単位に分割する必要があります。chunk メソッドは、キーと値の関係を維持しつつ、JSONコンテンツを賢く分割します。以下の例では、検索や検索結果の取得に向けてJSONドキュメントをチャンク化する方法を示します。

```tsx copy
import { MDocument } from '@mastra/rag';

const testJson = {
  name: 'ジョン・ドウ',
  age: 30,
  email: 'john.doe@example.com',
};

const doc = MDocument.fromJSON(JSON.stringify(testJson));

const chunks = await doc.chunk({
  maxSize: 100,
});

console.log(chunks);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/chunk-json"
}
/>
