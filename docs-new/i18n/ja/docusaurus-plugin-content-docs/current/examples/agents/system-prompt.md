---
title: "システムプロンプトを用いたエージェント"
description: Mastraで、システムプロンプトによって性格や能力を定義するAIエージェントを作成する例。
---

# システムプロンプトの変更 \{#changing-the-system-prompt\}

エージェントを作成する際、`instructions` はその振る舞いに関する一般的なルールを定義します。これらはエージェントの役割や人格、全体的なアプローチを定め、すべてのやり取りで一貫して適用されます。`system` プロンプトは、元の `instructions` を変更することなく、特定のリクエストにおけるエージェントの応答へ影響を与えるために `.generate()` に渡すことができます。

この例では、`system` プロンプトを使ってエージェントの「声」をハリー・ポッターのさまざまなキャラクター風に切り替え、コア設定を変えずに同じエージェントが文体を切り替えられることを示しています。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用します。`.env` ファイルに `OPENAI_API_KEY` を追加してください。

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

## エージェントの作成 \{#creating-an-agent\}

エージェントを定義し、`instructions` を指定します。これはエージェントの既定の動作を設定し、実行時にシステムプロンプトが与えられない場合の応答方法を記述します。

```typescript filename="src/mastra/agents/example-harry-potter-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const harryPotterAgent = new Agent({
  name: 'harry-potter-agent',
  description: 'ハリー・ポッターの世界のキャラクター風の応答を提供します。',
  instructions: `あなたはハリー・ポッターの世界のキャラクターボイスアシスタントです。
    指定されたキャラクター(例:ハリー、ハーマイオニー、ロン、ダンブルドア、スネイプ、ハグリッド)の話し方で返答してください。
    キャラクターが指定されていない場合は、ハリー・ポッターとして応答します。`,
  model: openai('gpt-4o'),
});
```

> 設定オプションの一覧については、[Agent](/docs/reference/agents/agent)を参照してください。

## エージェントの登録 \{#registering-an-agent\}

エージェントを使用するには、メインの Mastra インスタンスに登録してください。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';

import { harryPotterAgent } from './agents/example-harry-potter-agent';

export const mastra = new Mastra({
  // ...
  agents: { harryPotterAgent },
});
```

## デフォルトのキャラクター応答 \{#default-character-response\}

`getAgent()` を使ってエージェントを取得し、プロンプトを渡して `generate()` を呼び出します。手順で定義されているとおり、キャラクターが指定されていない場合、このエージェントは Harry Potter の声で応答するのがデフォルトです。

```typescript filename="src/test-harry-potter-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('harryPotterAgent');

const response = await agent.generate('ホグワーツで一番好きな部屋はどこですか?');

console.log(response.text);
```

### キャラクターの声を変更する \{#changing-the-character-voice\}

実行時に別のシステムプロンプトを指定すると、エージェントの声を別のキャラクターに切り替えられます。これにより、元の指示を変えることなく、そのリクエストに対するエージェントの応答の仕方が変わります。

```typescript {9-10} filename="src/test-harry-potter-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('harryPotterAgent');

const response = await agent.generate([
  {
    role: 'system',
    content: 'あなたはドラコ・マルフォイです。',
  },
  {
    role: 'user',
    content: 'ホグワーツで一番好きな部屋はどこですか?',
  },
]);

console.log(response.text);
```

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/agents/system-prompt" />

## 関連項目 \{#related\}

* [エージェントの呼び出し](./calling-agents#from-the-command-line)