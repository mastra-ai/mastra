---
title: "エージェントの呼び出し"
description: エージェントを呼び出す例。
---

# エージェントの呼び出し \{#calling-agents\}

Mastra で作成したエージェントとやり取りする方法はいくつかあります。以下では、ワークフローのステップ、ツール、[Mastra Client SDK](/docs/server-db/mastra-client)、そしてローカルでの迅速なテストに使えるコマンドラインを用いてエージェントを呼び出す例を紹介します。

このページでは、[システムプロンプトの変更](./system-prompt)の例で説明している `harryPotterAgent` の呼び出し方を示します。

## ワークフローのステップから \{#from-a-workflow-step\}

`mastra` インスタンスは、ワークフローのステップの `execute` 関数に引数として渡されます。`getAgent()` を使って登録済みのエージェントにアクセスできます。このメソッドでエージェントを取得し、プロンプトを渡して `generate()` を呼び出してください。

```typescript filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const step1 = createStep({
  // ...
  execute: async ({ mastra }) => {
    const agent = mastra.getAgent('harryPotterAgent');
    const response = await agent.generate('ホグワーツで一番好きな部屋はどこですか?');

    console.log(response.text);
  },
});

export const testWorkflow = createWorkflow({
  // ...
})
  .then(step1)
  .commit();
```

## ツールから \{#from-a-tool\}

`mastra` インスタンスは、ツールの `execute` 関数内で利用できます。`getAgent()` を使って登録済みのエージェントを取得し、プロンプトを渡して `generate()` を呼び出してください。

```typescript filename="src/mastra/tools/test-tool.ts" showLineNumbers copy
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const testTool = createTool({
  // ...
  execute: async ({ mastra }) => {
    const agent = mastra.getAgent('harryPotterAgent');
    const response = await agent.generate('ホグワーツで一番好きな部屋はどこですか?');

    console.log(response!.text);
  },
});
```

## Mastra Client から \{#from-mastra-client\}

`mastraClient` インスタンスは、登録済みエージェントへのアクセスを提供します。`getAgent()` でエージェントを取得し、`messages` 配列（role と content のペア）を含むオブジェクトを渡して `generate()` を呼び出します。

```typescript showLineNumbers copy
import { mastraClient } from '../lib/mastra-client';

const agent = mastraClient.getAgent('harryPotterAgent');
const response = await agent.generate({
  messages: [
    {
      role: 'user',
      content: 'ホグワーツで一番好きな部屋はどこですか?',
    },
  ],
});

console.log(response.text);
```

> 詳細は [Mastra Client SDK](/docs/server-db/mastra-client) をご覧ください。

## コマンドラインから \{#from-the-command-line\}

エージェントをローカルでテストするための簡単なスクリプトを作成できます。`mastra` インスタンスでは、`getAgent()` を使って登録済みのエージェントにアクセスできます。

モデルが環境変数（例：`OPENAI_API_KEY`）にアクセスできるようにするには、`dotenv` をインストールし、スクリプトの先頭でインポートしてください。

```typescript filename="src/test-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('harryPotterAgent');
const response = await agent.generate('ホグワーツで一番好きな部屋はどこですか?');

console.log(response.text);
```

### スクリプトを実行する \{#run-the-script\}

コマンドラインで次のコマンドを使って、このスクリプトを実行します:

```bash
npx tsx src/test-agent.ts
```

## curl から \{#from-curl\}

登録済みのエージェントとは、Mastra アプリケーションの `/generate` エンドポイントに `POST` リクエストを送信することでやり取りできます。`messages` 配列には、role と content のペアを含めてください。

```bash
curl -X POST http://localhost:4111/api/agents/harryPotterAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "ホグワーツで一番好きな部屋は何ですか?"
      }
    ]
  }'| jq -r '.text'
```

## 出力例 \{#example-output\}

```text
そうですね、選ぶとしたら、グリフィンドールの談話室ですね。
そこは、ロンやハーマイオニーと最高の時間を過ごした場所です。
暖かい暖炉、居心地の良い肘掛け椅子、そして仲間意識が、まるで家のように感じさせてくれます。
それに、私たちの冒険を計画する場所でもあります!
```
