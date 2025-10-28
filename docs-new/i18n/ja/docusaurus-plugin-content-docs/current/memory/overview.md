---
title: "概要"
description: "Mastra のメモリーシステムが、ワーキングメモリー、会話履歴、セマンティックリコールを用いてどのように機能するかを学びましょう。"
sidebar_position: 1
---

# メモリの概要 \{#memory-overview\}

Mastra のメモリは、関連情報を言語モデルのコンテキストウィンドウに要約・集約することで、エージェントが複数の会話にまたがるコンテキストを管理できるようにします。

Mastra は、ワーキングメモリ、会話履歴、セマンティックリコールの3種類のメモリをサポートします。さらに「2層」のスコープ方式を採用しており、メモリを会話スレッド単位で分離（スレッドスコープ）したり、同一ユーザーのすべての会話で共有（リソーススコープ）したりできます。

Mastra のメモリシステムは、[ストレージプロバイダー](#memory-storage-adapters) を利用して、アプリケーションの再起動後も会話スレッド、メッセージ、ワーキングメモリを保持します。

## はじめに \{#getting-started\}

まず、必要な依存関係をインストールします。

```bash copy
npm install @mastra/core @mastra/memory @mastra/libsql
```

次に、メインの Mastra インスタンスにストレージアダプターを追加します。メモリを有効にしたエージェントは、この共有ストレージを使ってやり取りを保存し、後から参照できます。

```typescript {6-8} filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';

export const mastra = new Mastra({
  // ...
  storage: new LibSQLStore({
    url: ':memory:',
  }),
});
```

次に、エージェントの `memory` パラメータに `Memory` インスタンスを渡してメモリを有効にします：

```typescript {3-5} filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';

export const testAgent = new Agent({
  // ...
  memory: new Memory(),
});
```

そのメモリインスタンスには、ワーキングメモリ、会話履歴、セマンティックリコールを設定できるオプションがあります。

## メモリの種類 \{#different-types-of-memory\}

Mastra は3種類のメモリをサポートしています：ワーキングメモリ、会話履歴、セマンティックリコール。

[**ワーキングメモリ**](./working-memory) は、名前、好み、目標、その他の構造化データなど、ユーザー固有の情報を永続的に保存します（ChatGPT に「私について教えて」とお願いできる機能を想像してください）。これは、エージェントが時間の経過とともに更新できる Markdown テキストのブロックとして実装されています（または Zod スキーマとして実装することもできます）。

[**会話履歴**](./conversation-history) は、現在の会話における直近のメッセージを記録し、短期的な一貫性を保って対話の流れを維持します。

[**セマンティックリコール**](./semantic-recall) は、意味的な関連度に基づいて過去の会話から古いメッセージを検索・取得します。類似メッセージはベクター検索で見つけ、理解を深めるために周辺のコンテキストも含められます。

Mastra はこれらすべてのメモリを単一のコンテキストウィンドウに統合します。合計がモデルのトークン上限を超える場合は、[メモリプロセッサ](./memory-processors) を使用して、モデルに送信する前にメッセージを圧縮・要約したり、フィルタリングしたりしてください。

## スレッドとリソースによるメモリのスコープ設定 \{#scoping-memory-with-threads-and-resources\}

すべてのメモリタイプは、デフォルトでは[スレッドスコープ](./working-memory#thread-scoped-memory-default)で、単一の会話にのみ適用されます。[リソーススコープ](./working-memory#resource-scoped-memory)の設定を使うと、同じユーザーまたはエンティティを共有するすべてのスレッド間で、ワーキングメモリとセマンティックリコールを保持できます。

## メモリストレージアダプター \{#memory-storage-adapters\}

会話間で情報を永続化・再利用するには、メモリにはストレージアダプターが必要です。

サポートされているオプションは、[LibSQL](/docs/examples/memory/memory-with-libsql)、[Postgres](/docs/examples/memory/memory-with-pg)、[Upstash](/docs/examples/memory/memory-with-upstash)です。

LibSQL はファイルベースまたはインメモリで動作し、インストールが簡単でプレイグラウンドとの相性も良いため、標準で採用しています。

## 専用ストレージ \{#dedicated-storage\}

エージェントごとに専用のストレージを設定でき、タスク、会話、および想起された情報をエージェント間で分離して保持できます。

### エージェントへのストレージ追加 \{#adding-storage-to-agents\}

エージェントに専用のストレージを割り当てるには、必要な依存関係をインストールしてインポートし、`Memory` コンストラクタに `storage` インスタンスを渡します：

```typescript {3, 9-11} filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';

export const testAgent = new Agent({
  // ...
  memory: new Memory({
    // ...
    storage: new LibSQLStore({
      url: 'file:agent-memory.db',
    }),
    // ...
  }),
});
```

## 取得されたメッセージの表示 \{#viewing-retrieved-messages\}

Mastra のデプロイでトレーシングが有効になっており、メモリが `lastMessages` や `semanticRecall` で構成されている場合、エージェントのトレース出力には、コンテキスト用に取得されたすべてのメッセージ（直近の会話履歴と、セマンティックリコールで想起されたメッセージの両方）が表示されます。

これは、デバッグ、エージェントの意思決定の理解、そして各リクエストに対してエージェントが適切な情報を取得できているかの検証に役立ちます。

トレーシングの有効化と設定の詳細は、[AI Tracing](/docs/observability/ai-tracing/overview) を参照してください。

## LibSQL を使ったローカル開発 \{#local-development-with-libsql\}

`LibSQLStore` を用いたローカル開発では、VS Code の [SQLite Viewer](https://marketplace.visualstudio.com/items?itemName=qwtel.sqlite-viewer) 拡張機能を使って保存されたメモリを確認できます。

![SQLite Viewer](/img/memory/memory-sqlite-viewer.jpg)

## 次のステップ \{#next-steps\}

コア概念を理解したら、[semantic recall](./semantic-recall) に進み、Mastra エージェントに RAG メモリを追加する方法を学びましょう。

また、利用可能なオプションについては [設定リファレンス](/docs/reference/memory) も参照してください。