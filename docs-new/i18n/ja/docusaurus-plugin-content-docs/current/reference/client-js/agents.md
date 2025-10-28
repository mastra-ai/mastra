---
title: Mastra クライアントエージェント API
description: client-js SDK を使って、応答生成、ストリーミングでのやり取り、エージェントツールの管理など、Mastra の AI エージェントとの対話方法を学びます。
---

# Agents API \{#agents-api\}

Agents API は、Mastra の AI エージェントとの対話に用いるメソッドを提供し、応答の生成、対話のストリーミング、エージェント用ツールの管理を行えます。

## すべてのエージェントの取得 \{#getting-all-agents\}

利用可能なすべてのエージェントの一覧を取得します。

```typescript
const agents = await mastraClient.getAgents();
```

## 特定のエージェントを扱う \{#working-with-a-specific-agent\}

特定のエージェントのインスタンスを取得する:

```typescript
const agent = mastraClient.getAgent('agent-id');
```

## エージェントメソッド \{#agent-methods\}

### エージェントの詳細を取得 \{#get-agent-details\}

エージェントに関する詳細情報を取得します。

```typescript
const details = await agent.details();
```

### 応答の生成 \{#generate-response\}

エージェントから応答を生成します：

```typescript
const response = await agent.generate({
  messages: [
    {
      role: 'user',
      content: 'こんにちは、お元気ですか?',
    },
  ],
  threadId: 'thread-1', // オプション: 会話コンテキスト用のスレッドID
  resourceId: 'resource-1', // オプション: リソースID
  output: {}, // オプション: 出力設定
});
```

### ストリーミング応答 \{#stream-response\}

リアルタイムの対話に向けて、エージェントからの応答をストリーミングします：

```typescript
const response = await agent.stream({
  messages: [
    {
      role: 'user',
      content: '物語を聞かせて',
    },
  ],
});

// processDataStreamユーティリティを使用してデータストリームを処理
response.processDataStream({
  onTextPart: text => {
    process.stdout.write(text);
  },
  onFilePart: file => {
    console.log(file);
  },
  onDataPart: data => {
    console.log(data);
  },
  onErrorPart: error => {
    console.error(error);
  },
});

// processTextStreamユーティリティを使用してテキストストリームを処理
// (構造化出力で使用)
response.processTextStream({
  onTextPart: text => {
    process.stdout.write(text);
  },
});

// レスポンスボディから直接読み取ることも可能
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(new TextDecoder().decode(value));
}
```

### クライアントツール \{#client-tools\}

クライアント側ツールを使うと、エージェントからの要求に応じてクライアント側でカスタム関数を実行できます。

#### 基本的な使用方法 \{#basic-usage\}

```typescript
import { createTool } from '@mastra/client-js';
import { z } from 'zod';

const colorChangeTool = createTool({
  id: 'changeColor',
  description: '背景色を変更します',
  inputSchema: z.object({
    color: z.string(),
  }),
  execute: async ({ context }) => {
    document.body.style.backgroundColor = context.color;
    return { success: true };
  },
});

// generate で使用
const response = await agent.generate({
  messages: '背景を青に変更',
  clientTools: { colorChangeTool },
});

// stream で使用
const response = await agent.stream({
  messages: '背景を緑に変更',
  clientTools: { colorChangeTool },
});

response.processDataStream({
  onTextPart: text => console.log(text),
  onToolCallPart: toolCall => console.log('ツールが呼び出されました:', toolCall.toolName),
});
```

### エージェント ツールを取得 \{#get-agent-tool\}

エージェントで利用可能な特定のツールの情報を取得します。

```typescript
const tool = await agent.getTool('tool-id');
```

### エージェント評価の取得 \{#get-agent-evaluations\}

エージェントの評価結果を取得します。

```typescript
// CI評価を取得
const evals = await agent.evals();

// ライブ評価を取得
const liveEvals = await agent.liveEvals();
```

### Stream \{#stream\}

拡張版APIと改良されたメソッドシグネチャを使って、レスポンスをストリーミングします。これにより機能が強化され、フォーマットの柔軟性も向上し、Mastraのネイティブ形式がサポートされます。

```typescript
const response = await agent.stream('物語を聞かせて', {
  threadId: 'thread-1',
  clientTools: { colorChangeTool },
});

// ストリームを処理
response.processDataStream({
  onChunk: chunk => {
    console.log(chunk);
  },
});
```

現在、AI SDK v5 形式はクライアント SDK ではサポートされていません。
AI SDK v5 互換の形式については、`@mastra/ai-sdk` パッケージをご利用ください
[AI SDK v5 のストリーム互換性](/docs/frameworks/agentic-uis/ai-sdk#enabling-stream-compatibility)

### 生成 \{#generate\}

改良されたメソッドシグネチャと AI SDK v5 互換の拡張 API を使ってレスポンスを生成します。

```typescript
const response = await agent.generate('こんにちは、お元気ですか?', {
  threadId: 'thread-1',
  resourceId: 'resource-1',
});
```
