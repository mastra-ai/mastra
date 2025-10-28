---
title: "セマンティックリコール"
description: "Mastra でベクトル検索と埋め込みを使って、過去の会話から関連メッセージを取得するセマンティックリコールの使い方を学びます。"
sidebar_position: 5
---

# セマンティックリコール \{#semantic-recall\}

友人に先週末に何をしたか尋ねると、相手は「先週末」に紐づく出来事を記憶から探し出し、その内容を教えてくれます。Mastra のセマンティックリコールも、これと似た仕組みで動作します。

> **📹 視聴**: セマンティックリコールとは何か、その仕組み、そして Mastra での設定方法 → [YouTube（5分）](https://youtu.be/UVZtK8cK8xQ)

## セマンティックリコールの仕組み \{#how-semantic-recall-works\}

セマンティックリコールはRAGベースの検索機能で、メッセージが[直近の会話履歴](./overview)から外れても、エージェントが長い対話にわたって文脈を維持できるようにします。

メッセージのベクトル埋め込みを用いた類似検索を行い、各種ベクターストアと連携し、取得したメッセージの前後に配置するコンテキストウィンドウを設定できます。

<br />

<img src="/img/semantic-recall.png" alt="Mastra Memory のセマンティックリコールを示す図" width={800} />

有効化されると、新しいメッセージを使ってベクターDBにクエリを投げ、意味的に類似したメッセージを検索します。

LLMからの応答を受け取った後は、すべての新しいメッセージ（ユーザー、アシスタント、ツールの呼び出し／結果）を、今後の対話で再利用できるようベクターDBに格納します。

## クイックスタート \{#quick-start\}

Semantic recall はデフォルトで有効になっているため、エージェントにメモリを付与すると自動的に取り込まれます。

```typescript {9}
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';

const agent = new Agent({
  name: 'SupportAgent',
  instructions: 'あなたは親切なサポート担当者です。',
  model: openai('gpt-4o'),
  memory: new Memory(),
});
```

## リコール設定 \{#recall-configuration\}

セマンティック・リコールの挙動を制御する主なパラメータは次の3つです。

1. **topK**: 取得する意味的に類似したメッセージの数
2. **messageRange**: 各一致に含める周辺コンテキストの範囲
3. **scope**: 現在のスレッド内のみで検索するか、リソースに属するすべてのスレッドを対象に検索するか。`scope: 'resource'` を使用すると、エージェントはユーザーの過去のいずれの会話からでも情報を想起できます。

```typescript {5-7}
const agent = new Agent({
  memory: new Memory({
    options: {
      semanticRecall: {
        topK: 3, // 類似度の高い3件のメッセージを取得
        messageRange: 2, // 各マッチの前後2件のメッセージを含める
        scope: 'resource', // このユーザーの全スレッドを検索
      },
    },
  }),
});
```

注: 現在、セマンティックリコール用の `scope: 'resource'` は、以下のストレージアダプターでサポートされています：LibSQL、Postgres、Upstash。

### ストレージの構成 \{#storage-configuration\}

Semantic recall は、メッセージとその埋め込みを保存するために、ストレージとベクトルデータベースに依存します。

```ts {8-17}
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';

const agent = new Agent({
  memory: new Memory({
    // 省略した場合のデフォルトストレージDB
    storage: new LibSQLStore({
      url: 'file:./local.db',
    }),
    // 省略した場合のデフォルトベクトルDB
    vector: new LibSQLVector({
      connectionUrl: 'file:./local.db',
    }),
  }),
});
```

**ストレージ／ベクターのコード例**:

* [LibSQL](/docs/examples/memory/memory-with-libsql)
* [Postgres](/docs/examples/memory/memory-with-pg)
* [Upstash](/docs/examples/memory/memory-with-upstash)

### Embedder の設定 \{#embedder-configuration\}

Semantic recall は、メッセージをベクトル化するために埋め込みモデルを用います。AI SDK と互換性のある[埋め込みモデル](https://sdk.vercel.ai/docs/ai-sdk-core/embeddings)であれば、任意のものを指定できます。

FastEmbed（ローカル実行の埋め込みモデル）を使うには、`@mastra/fastembed` をインストールします:

```bash npm2yarn copy
npm install @mastra/fastembed
```

次に、メモリにそれを構成します：

```ts {3,8}
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { fastembed } from '@mastra/fastembed';

const agent = new Agent({
  memory: new Memory({
    // ... その他のメモリーオプション
    embedder: fastembed,
  }),
});
```

または、OpenAI などの別のプロバイダーを使用します：

```ts {3,8}
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

const agent = new Agent({
  memory: new Memory({
    // ... その他のメモリオプション
    embedder: openai.embedding('text-embedding-3-small'),
  }),
});
```

### PostgreSQLのインデックス最適化 \{#postgresql-index-optimization\}

PostgreSQLをベクターストアとして使用する場合、ベクトルインデックスを適切に設定することで、セマンティック検索の再現率（リコール）を最適化できます。これは、数千件のメッセージを扱う大規模な運用環境で特に重要です。

PostgreSQLはIVFFlatとHNSWの両インデックスをサポートしています。既定ではMastraはIVFFlatインデックスを作成しますが、HNSWインデックスの方が一般的に高いパフォーマンスを発揮します。特に、内積距離を用いるOpenAIの埋め込みでは効果的です。

```typescript {9-18}
import { Memory } from '@mastra/memory';
import { PgStore, PgVector } from '@mastra/pg';

const agent = new Agent({
  memory: new Memory({
    storage: new PgStore({
      connectionString: process.env.DATABASE_URL,
    }),
    vector: new PgVector({
      connectionString: process.env.DATABASE_URL,
    }),
    options: {
      semanticRecall: {
        topK: 5,
        messageRange: 2,
        indexConfig: {
          type: 'hnsw', // パフォーマンス向上のためHNSWを使用
          metric: 'dotproduct', // OpenAI埋め込みに最適
          m: 16, // 双方向リンク数（デフォルト: 16）
          efConstruction: 64, // 構築時の候補リストサイズ（デフォルト: 64）
        },
      },
    },
  }),
});
```

インデックスの設定オプションや性能チューニングの詳細については、[PgVector 設定ガイド](/docs/reference/vectors/pg#index-configuration-guide)をご参照ください。

### 無効化 \{#disabling\}

Semantic recall の使用にはパフォーマンスへの影響があります。新しいメッセージは埋め込みに変換され、LLM に送信する前にベクターデータベースのクエリに利用されます。

Semantic recall はデフォルトで有効ですが、不要な場合は無効化できます:

```typescript {4}
const agent = new Agent({
  memory: new Memory({
    options: {
      semanticRecall: false,
    },
  }),
});
```

次のようなシナリオでは、semantic recall を無効にしたほうがよい場合があります:

* 会話履歴だけで、現在のやり取りに必要なコンテキストが十分に確保できている場合
* リアルタイムの双方向音声などのパフォーマンス重視のアプリケーションで、embedding の作成やベクトル検索の実行による追加の待ち時間が無視できない場合

## リコールされたメッセージの表示 \{#viewing-recalled-messages\}

トレースが有効な場合、semantic recall によって取得されたメッセージは、（設定されていれば）直近の会話履歴とともに、エージェントのトレース出力に表示されます。

メッセージトレースの表示方法の詳細は、[Retrieved Messages の表示](./overview#viewing-retrieved-messages)を参照してください。