---
title: "メモリプロセッサ"
description: トークンの制限、ツール呼び出しのフィルタリング、カスタムフィルターの作成にメモリプロセッサを活用する方法を示す例。
---

# メモリプロセッサ \{#memory-processors\}

メモリプロセッサを使うと、メッセージをエージェントに渡す前に、呼び出されたメッセージをフィルタリング、変換、または絞り込めます。以下の例では、トークン上限の適用、ツール呼び出しの除外、カスタムプロセッサの実装方法を示します。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用します。`.env` ファイルに `OPENAI_API_KEY` を追加してください。

```bash filename=".env" copy
OPENAI_API_KEY=<あなたのAPIキー>
```

次のパッケージをインストールします：

```bash copy
npm install @mastra/libsql
```

## エージェントにメモリを追加する \{#adding-memory-to-an-agent\}

エージェントに LibSQL のメモリを追加するには、`Memory` クラスを使用し、`LibSQLStore` を用いて `storage` インスタンスを渡します。`url` はリモートの場所またはローカルファイルを指すことができます。

### メモリプロセッサの設定 \{#memory-processor-configuration\}

`workingMemory.enabled` を `true` に設定してワーキングメモリを有効化します。これにより、エージェントは対話間で構造化情報を保持できるようになります。この例では、`TokenLimiter` で想起するトークン数を制限し、`ToolCallFilter` でツール呼び出しを除外するために、メモリプロセッサも併用しています。

```typescript filename="src/mastra/agents/example-working-memory-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { TokenLimiter, ToolCallFilter } from '@mastra/memory/processors';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { LibSQLStore } from '@mastra/libsql';

export const memoryProcessorAgent = new Agent({
  name: 'memory-processor-agent',
  instructions: 'あなたは過去のやり取りから自動的に記憶を想起できるAIエージェントです。',
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:memory-processor.db',
    }),
    processors: [new TokenLimiter(127000), new ToolCallFilter()],
    options: {
      workingMemory: {
        enabled: true,
      },
      generateTitle: true, // タイトルの自動生成を明示的に有効にする
    },
  }),
});
```

### トークンリミッターの使用 \{#using-token-limiters\}

トークンリミッターは、想起されたメッセージを短縮して、エージェントに渡すトークン数を制御します。これにより、コンテキストの規模を適切に管理し、モデルの上限を超えないようにできます。

```typescript showLineNumbers
import { Memory } from '@mastra/memory';
import { TokenLimiter } from '@mastra/memory/processors';

export const memoryProcessorAgent = new Agent({
  // ...
  memory: new Memory({
    // ...
    processors: [new TokenLimiter(127000)],
  }),
});
```

### トークンエンコーディングの使用 \{#using-token-encoding\}

`js-tiktoken`パッケージの`cl100k_base`など、特定のエンコーディングを指定することで、トークンのカウント方法をカスタマイズできます。これにより、モデルごとのトークン上限を正確に把握できます。

```typescript showLineNumbers
import { Memory } from '@mastra/memory';
import { TokenLimiter } from '@mastra/memory/processors';
import cl100k_base from 'js-tiktoken/ranks/cl100k_base';

export const memoryProcessorAgent = new Agent({
  // 省略
  memory: new Memory({
    // 省略
    processors: [
      new TokenLimiter({
        limit: 16000,
        encoding: cl100k_base,
      }),
    ],
  }),
});
```

### ツール呼び出しのフィルタリング \{#filtering-tool-calls\}

`ToolCallFilter` プロセッサは、特定のツール呼び出しとその結果をメモリから削除します。ログ記録や画像生成といったツールを除外することで、ノイズを抑え、エージェントの集中を維持できます。

```typescript showLineNumbers
import { Memory } from '@mastra/memory';
import { ToolCallFilter } from '@mastra/memory/processors';

export const memoryProcessorAgent = new Agent({
  // ...
  memory: new Memory({
    // ...
    processors: [
      new ToolCallFilter({
        exclude: ['exampleLoggerTool', 'exampleImageGenTool'],
      }),
    ],
  }),
});
```

## カスタムプロセッサーの作成 \{#creating-custom-processors\}

カスタムメモリプロセッサーは `MemoryProcessor` クラスを拡張して作成でき、エージェントに送信する前に、想起されたメッセージ一覧に独自のロジックを適用できます。

```typescript filename="src/mastra/processors/example-recent-messages-processor.ts" showLineNumbers copy
import { MemoryProcessor } from '@mastra/core/memory';
import type { CoreMessage } from '@mastra/core';

export class RecentMessagesProcessor extends MemoryProcessor {
  private limit: number;

  constructor(limit: number = 10) {
    super({ name: 'RecentMessagesProcessor' });
    this.limit = limit;
  }

  process(messages: CoreMessage[]): CoreMessage[] {
    return messages.slice(-this.limit);
  }
}
```

### カスタムプロセッサーの使用 \{#custom-processor-usage\}

この例では、`RecentMessagesProcessor` を使用し、上限を `5` に設定して、メモリから直近の5件のメッセージのみを返します。

```typescript showLineNumbers
import { Memory } from '@mastra/memory';
import { ToolCallFilter } from '@mastra/memory/processors';
import { RecentMessagesProcessor } from '../processors/example-recent-messages-processor';

export const memoryProcessorAgent = new Agent({
  // 省略
  memory: new Memory({
    // 省略
    processors: [new RecentMessagesProcessor(5)],
  }),
});
```

## 関連項目 \{#related\}

* [エージェントの呼び出し](../agents/calling-agents#from-the-command-line)
* [メモリプロセッサ](/docs/memory/memory-processors)