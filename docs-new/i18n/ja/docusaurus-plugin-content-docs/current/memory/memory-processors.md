---
title: "メモリプロセッサ"
description: "Mastra のメモリプロセッサを使って、メッセージを言語モデルに送信する前にフィルタリング、トリミング、変換し、コンテキストウィンドウの制約を管理する方法を学びます。"
---

# メモリプロセッサ \{#memory-processors\}

メモリプロセッサは、エージェントのコンテキストウィンドウに追加して LLM に送信する前に、メモリから取得したメッセージ一覧を変更できるようにします。これは、コンテキストサイズの管理、コンテンツのフィルタリング、パフォーマンスの最適化に役立ちます。

プロセッサは、メモリ設定（例: `lastMessages`、`semanticRecall`）に基づいて取得されたメッセージに対して動作します。新規に受信したユーザーメッセージには**影響しません**。

## 組み込みプロセッサ \{#built-in-processors\}

Mastra には組み込みのプロセッサが用意されています：

### `TokenLimiter` \{#tokenlimiter\}

このプロセッサは、LLM のコンテキストウィンドウの上限超過によるエラーを防ぐために使用されます。取得したメモリメッセージのトークン数を数え、合計が指定された `limit` を下回るまで最も古いメッセージから順に削除します。

```typescript copy showLineNumbers {9-12}
import { Memory } from '@mastra/memory';
import { TokenLimiter } from '@mastra/memory/processors';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

const agent = new Agent({
  model: openai('gpt-4o'),
  memory: new Memory({
    processors: [
      // メモリからの合計トークン数が約127kを超えないようにします
      new TokenLimiter(127000),
    ],
  }),
});
```

`TokenLimiter` はデフォルトで `o200k_base` エンコード方式を使用します（GPT-4o に適しています）。モデルに応じて必要であれば、別のエンコード方式を指定できます。

```typescript copy showLineNumbers {6-9}
// 必要なエンコーディングをインポートします(例:古いOpenAIモデル用)
import cl100k_base from 'js-tiktoken/ranks/cl100k_base';

const memoryForOlderModel = new Memory({
  processors: [
    new TokenLimiter({
      limit: 16000, // 16kコンテキストモデルの制限例
      encoding: cl100k_base,
    }),
  ],
});
```

エンコーディングの詳細については、[OpenAI Cookbook](https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken#encodings) または [`js-tiktoken` リポジトリ](https://github.com/dqbd/tiktoken) を参照してください。

### `ToolCallFilter` \{#toolcallfilter\}

このプロセッサは、LLM に送信されるメモリメッセージからツール呼び出しを取り除きます。コンテキストから冗長になりがちなツールとのやり取りを除外することでトークンを節約でき、詳細が今後の対話で不要な場合に有用です。また、エージェントに常に特定のツールを再実行させ、メモリ内の過去のツール結果に依存させたくない場合にも有用です。

```typescript copy showLineNumbers {5-14}
import { Memory } from '@mastra/memory';
import { ToolCallFilter, TokenLimiter } from '@mastra/memory/processors';

const memoryFilteringTools = new Memory({
  processors: [
    // 例1: すべてのツール呼び出し/結果を削除
    new ToolCallFilter(),

    // 例2: ノイズの多い画像生成ツールの呼び出し/結果のみを削除
    new ToolCallFilter({ exclude: ['generateImageTool'] }),

    // TokenLimiterは常に最後に配置してください
    new TokenLimiter(127000),
  ],
});
```

## 複数のプロセッサの適用 \{#applying-multiple-processors\}

複数のプロセッサをチェーンできます。`processors` 配列に記載された順に実行されます。あるプロセッサの出力は、次のプロセッサの入力になります。

**順序が重要です！** 一般的には、チェーンの **最後** に `TokenLimiter` を配置するのがベストプラクティスです。これにより、ほかのフィルタリングが行われた後の最終的なメッセージ群に対して動作し、最も正確にトークン制限を適用できます。

```typescript copy showLineNumbers {7-14}
import { Memory } from '@mastra/memory';
import { ToolCallFilter, TokenLimiter } from '@mastra/memory/processors';
// 仮想的な 'PIIFilter' カスタムプロセッサが存在すると仮定
// import { PIIFilter } from './custom-processors';

const memoryWithMultipleProcessors = new Memory({
  processors: [
    // 1. 最初に特定のツール呼び出しをフィルタリング
    new ToolCallFilter({ exclude: ['verboseDebugTool'] }),
    // 2. カスタムフィルタリングを適用(例: 仮想的な個人情報を削除 - 注意して使用)
    // new PIIFilter(),
    // 3. 最終ステップとしてトークン制限を適用
    new TokenLimiter(127000),
  ],
});
```

## カスタムプロセッサの作成 \{#creating-custom-processors\}

ベースとなる `MemoryProcessor` クラスを拡張して、独自のロジックを実装できます。

```typescript copy showLineNumbers {5-20,24-27}
import { Memory } from '@mastra/memory';
import { CoreMessage, MemoryProcessorOpts } from '@mastra/core';
import { MemoryProcessor } from '@mastra/core/memory';

class ConversationOnlyFilter extends MemoryProcessor {
  constructor() {
    // 必要に応じてデバッグしやすくするための名前を指定
    super({ name: 'ConversationOnlyFilter' });
  }

  process(
    messages: CoreMessage[],
    _opts: MemoryProcessorOpts = {}, // メモリ取得時に渡されるオプション。ここではほとんど使用しない
  ): CoreMessage[] {
    // ロールに基づいてメッセージをフィルタリング
    return messages.filter(msg => msg.role === 'user' || msg.role === 'assistant');
  }
}

// カスタムプロセッサを使用
const memoryWithCustomFilter = new Memory({
  processors: [
    new ConversationOnlyFilter(),
    new TokenLimiter(127000), // トークン制限も引き続き適用
  ],
});
```

カスタムプロセッサーを作成する際は、入力の `messages` 配列およびその要素（オブジェクト）を直接変更しないでください。
