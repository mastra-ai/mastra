---
sidebar_position: 1
title: "エージェント: Chef Michel"
description: Mastra で、手持ちの食材を使って調理を支援するシェフアシスタント エージェントを作成するためのガイド。
---

import YouTube from '@site/src/components/YouTube';

# AIシェフアシスタントを作成する \{#building-an-ai-chef-assistant\}

このガイドでは、手元の食材で料理を作るのを手伝う「Chef Assistant」エージェントを作成します。

まずエージェントを作成して Mastra に登録する方法を学びます。次に、ターミナルからエージェントと対話し、さまざまな応答形式を把握します。最後に、Mastra のローカル API エンドポイント経由でエージェントにアクセスします。

<YouTube id="_tZhOqHCrF0" />

## 前提条件 \{#prerequisites\}

* Node.js `v20.0` 以降がインストールされていること
* サポート対象の[モデルプロバイダー](/docs/models/providers)の API キー
* 既存の Mastra プロジェクト（新規プロジェクトのセットアップは[インストールガイド](/docs/getting-started/installation)をご参照ください）

## エージェントの作成 \{#creating-the-agent\}

Mastra でエージェントを作成するには、まず `Agent` クラスで定義し、その後 Mastra に登録します。

### エージェントを定義する \{#define-the-agent\}

新規ファイル `src/mastra/agents/chefAgent.ts` を作成し、エージェントを定義します。

```ts copy filename="src/mastra/agents/chefAgent.ts"
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const chefAgent = new Agent({
  name: 'chef-agent',
  instructions:
    'あなたはMichelです。実践的で経験豊富な家庭料理人です。' +
    '手元にある食材を使って料理ができるよう人々をサポートします。',
  model: openai('gpt-4o-mini'),
});
```

### Mastra にエージェントを登録する \{#register-the-agent-with-mastra\}

`src/mastra/index.ts` ファイルでエージェントを登録します：

```ts copy filename="src/mastra/index.ts" {2, 5}
import { Mastra } from '@mastra/core';
import { chefAgent } from './agents/chefAgent';

export const mastra = new Mastra({
  agents: { chefAgent },
});
```

## エージェントとの対話 \{#interacting-with-the-agent\}

要件に応じて、エージェントとやり取りし、さまざまな形式で応答を得ることができます。以下の手順では、生成、ストリーミング、構造化出力の取得方法を学びます。

### テキスト応答の生成 \{#generating-text-responses\}

新しいファイル `src/index.ts` を作成し、`main()` 関数を追加します。関数内でエージェントへの問い合わせを作成し、その応答をログに出力します。

```ts copy filename="src/index.ts"
import { chefAgent } from './mastra/agents/chefAgent';

async function main() {
  const query =
    '私のキッチンには、パスタ、トマト缶、ニンニク、オリーブオイル、そして乾燥ハーブ(バジルとオレガノ)があります。何が作れますか?';
  console.log(`クエリ: ${query}`);

  const response = await chefAgent.generate([{ role: 'user', content: query }]);
  console.log('\n👨‍🍳 シェフ・ミシェル:', response.text);
}

main();
```

その後、スクリプトを実行します。

```bash copy
npx bun src/index.ts
```

次のような出力が得られるはずです:

```
Query: 私のキッチンには、パスタ、トマト缶、ニンニク、オリーブオイル、そして乾燥ハーブ(バジルとオレガノ)があります。何が作れますか?

👨‍🍳 Chef Michel: 美味しいパスタ・アル・ポモドーロが作れますよ!作り方は次の通りです...
```

### ストリーミング応答 \{#streaming-responses\}

前の例では、進捗が見えないまましばらく応答を待つことになったかもしれません。エージェントが出力を生成するそばから表示するには、応答をターミナルにストリーミングするようにします。

```ts copy filename="src/index.ts"
import { chefAgent } from './mastra/agents/chefAgent';

async function main() {
  const query =
    "今、友達の家にいるんだけど、鶏もも肉、ココナッツミルク、さつまいも、それとカレー粉があるんだ。";
  console.log(`クエリ: ${query}`);

  const stream = await chefAgent.stream([{ role: 'user', content: query }]);

  console.log('\n シェフ・ミシェル: ');

  for await (const chunk of stream.textStream) {
    process.stdout.write(chunk);
  }

  console.log('\n\n✅ レシピ完成!');
}

main();
```

その後、スクリプトをもう一度実行してください：

```bash copy
npx bun src/index.ts
```

以下のような出力になるはずです。今回は大きな塊ではなく、行ごとに読み進められます。

```
クエリ: 今、友人の家にいるのですが、鶏もも肉、ココナッツミルク、さつまいも、カレー粉があります。

👨‍🍳 シェフ Michel:
いいですね!美味しいチキンカレーが作れますよ...

✅ レシピ完成!
```

### 構造化データでレシピを生成する \{#generating-a-recipe-with-structured-data\}

エージェントの応答を人に表示する代わりに、コードの別の部分へ渡したい場合があるかもしれません。こうした場合は、エージェントが[構造化出力](/docs/agents/overview#structured-output)を返すようにします。

`src/index.ts` を次の内容に変更してください:

```ts copy filename="src/index.ts"
import { chefAgent } from './mastra/agents/chefAgent';
import { z } from 'zod';

async function main() {
  const query = 'ラザニアを作りたいのですが、レシピを教えてもらえますか?';
  console.log(`クエリ: ${query}`);

  // Zodスキーマを定義
  const schema = z.object({
    ingredients: z.array(
      z.object({
        name: z.string(),
        amount: z.string(),
      }),
    ),
    steps: z.array(z.string()),
  });

  const response = await chefAgent.generate([{ role: 'user', content: query }], {
    structuredOutput: {
      schema,
    },
    maxSteps: 1,
  });
  console.log('\n👨‍🍳 シェフ・ミシェル:', response.object);
}

main();
```

スクリプトをもう一度実行すると、次のような出力が得られるはずです：

```
クエリ: ラザニアを作りたいのですが、レシピを生成してもらえますか?

👨‍🍳 Chef Michel: {
  ingredients: [
    { name: "ラザニア用パスタ", amount: "12枚" },
    { name: "牛ひき肉", amount: "450g" },
    // ...
  ],
  steps: [
    "オーブンを190℃(375°F)に予熱する。",
    "ラザニア用パスタをパッケージの表示通りに茹でる。",
    // ...
  ]
}
```

## エージェントサーバーの起動 \{#running-the-agent-server\}

Mastra の API を使ってエージェントとやり取りする方法を学びましょう。

### `mastra dev` の使用 \{#using-mastra-dev\}

`mastra dev` コマンドで、エージェントをサービスとして実行できます。

```bash copy
mastra dev
```

これにより、登録済みのエージェントとやり取りするためのエンドポイントを公開するサーバーが起動します。[playground](/docs/getting-started/local-dev-playground)内で、UIを通じてエージェントをテストできます。

### Chef Assistant API へのアクセス \{#accessing-the-chef-assistant-api\}

デフォルトでは、`mastra dev` は `http://localhost:4111` で実行されます。Chef Assistant エージェントは次の場所で利用できます：

```
POST http://localhost:4111/api/agents/chefAgent/generate
```

### `curl` を使ったエージェントとのやり取り \{#interacting-with-the-agent-via-curl\}

コマンドラインから `curl` を使ってエージェントとやり取りできます。

```bash copy
curl -X POST http://localhost:4111/api/agents/chefAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "卵と小麦粉と牛乳があります。何が作れますか?"
      }
    ]
  }'
```

**サンプル回答:**

```json
{
  "text": "美味しいパンケーキが作れます!簡単なレシピをご紹介します..."
}
```
