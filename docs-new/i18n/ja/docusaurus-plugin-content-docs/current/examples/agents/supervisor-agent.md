---
title: "スーパーバイザーエージェント"
description: Mastra を使ってスーパーバイザーエージェントを作成する例。エージェント同士がツール関数を通じてやり取りします。
---

# 監督エージェント \{#supervisor-agent\}

複雑なAIアプリケーションを構築する際には、タスクの異なる側面を担当して協働する複数の専門エージェントが必要になることがよくあります。監督エージェントは、あるエージェントが監督役となって他のエージェントの作業を調整し、各エージェントが自分の専門領域に集中できるようにします。この構成により、エージェント同士が委任・協働し、単一のエージェントだけでは成し得ない、より高度な成果物を生み出せます。

この例では、システムは3つのエージェントで構成されています:

1. 初期コンテンツを作成する[**Copywriter エージェント**](#copywriter-agent)。
2. コンテンツを洗練する[**Editor エージェント**](#editor-agent)。
3. 他のエージェントを監督・調整する[**Publisher エージェント**](#publisher-agent)。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用します。`.env` ファイルに `OPENAI_API_KEY` を追加してください。

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

## コピーライターエージェント \{#copywriter-agent\}

この `copywriterAgent` は、与えられたトピックに基づいてブログ記事の初稿コンテンツを作成する役割を担います。

```typescript filename="src/mastra/agents/example-copywriter-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const copywriterAgent = new Agent({
  name: 'copywriter-agent',
  instructions: 'あなたはブログ記事を執筆するコピーライターエージェントです。',
  model: openai('gpt-4o'),
});
```

## コピーライターツール \{#copywriter-tool\}

`copywriterTool` は `copywriterAgent` を呼び出し、`topic` を渡すためのインターフェースを提供します。

```typescript filename="src/mastra/tools/example-copywriter-tool.ts"
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const copywriterTool = createTool({
  id: 'copywriter-agent',
  description: 'ブログ記事の文章を作成するためにコピーライターエージェントを呼び出します。',
  inputSchema: z.object({
    topic: z.string(),
  }),
  outputSchema: z.object({
    copy: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const { topic } = context;

    const agent = mastra!.getAgent('copywriterAgent');
    const result = await agent!.generate(`${topic}に関するブログ記事を作成してください`);

    return {
      copy: result.text,
    };
  },
});
```

## 編集エージェント \{#editor-agent\}

この `editorAgent` は初稿を受け取り、品質と可読性を高めるために磨きをかけます。

```typescript filename="src/mastra/agents/example-editor-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const editorAgent = new Agent({
  name: 'Editor',
  instructions: 'あなたはブログ記事を編集するエージェントです。',
  model: openai('gpt-4o-mini'),
});
```

## エディターツール \{#editor-tool\}

`editorTool` は `editorAgent` を呼び出すためのインターフェースを提供し、`copy` を渡します。

```typescript filename="src/mastra/tools/example-editor-tool.ts" showLineNumbers copy
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const editorTool = createTool({
  id: 'editor-agent',
  description: 'ブログ記事の本文を編集するためにエディターエージェントを呼び出します。',
  inputSchema: z.object({
    copy: z.string(),
  }),
  outputSchema: z.object({
    copy: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const { copy } = context;

    const agent = mastra!.getAgent('editorAgent');
    const result = await agent.generate(`次のブログ記事を編集し、編集後の本文のみを返してください: ${copy}`);

    return {
      copy: result.text,
    };
  },
});
```

## Publisher エージェント \{#publisher-agent\}

この `publisherAgent` は、まず `copywriterTool` を呼び出し、その後に `editorTool` を呼び出して、プロセス全体を調整します。

```typescript filename="src/mastra/agents/example-publisher-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

import { copywriterTool } from '../tools/example-copywriter-tool';
import { editorTool } from '../tools/example-editor-tool';

export const publisherAgent = new Agent({
  name: 'publisherAgent',
  instructions:
    'あなたは、まずコピーライターエージェントを呼び出して特定のトピックに関するブログ記事を作成し、次にエディターエージェントを呼び出してその内容を編集するパブリッシャーエージェントです。最終的に編集された内容のみを返してください。',
  model: openai('gpt-4o-mini'),
  tools: { copywriterTool, editorTool },
});
```

## エージェントの登録 \{#registering-the-agents\}

3つのエージェントはすべてメインのMastraインスタンスに登録され、互いにアクセスできるようになります。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';

import { publisherAgent } from './agents/example-publisher-agent';
import { copywriterAgent } from './agents/example-copywriter-agent';
import { editorAgent } from './agents/example-editor-agent';

export const mastra = new Mastra({
  agents: { copywriterAgent, editorAgent, publisherAgent },
});
```

## 使用例 \{#example-usage\}

`getAgent()` でエージェントの参照を取得し、プロンプトを渡して `generate()` を呼び出します。

```typescript filename="src/test-publisher-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('publisherAgent');

const response = await agent.generate(
  'React JavaScriptフレームワークに関するブログ記事を書いてください。最終的な編集済みの原稿のみを返してください。',
);

console.log(response.text);
```

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/agents/hierarchical-multi-agent" />

## 関連項目 \{#related\}

* [エージェントの呼び出し](./calling-agents#from-the-command-line)