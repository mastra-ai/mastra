---
title: "ワーキングメモリ"
description: "Mastra で永続的なユーザーデータやユーザー設定を保存するためのワーキングメモリの設定方法を学びましょう。"
sidebar_position: 3
---

import YouTube from '@site/src/components/YouTube';

# ワーキングメモリ \{#working-memory\}

[会話履歴](/docs/memory/overview) と [セマンティックリコール](./semantic-recall) がエージェントの会話の記憶を助ける一方で、ワーキングメモリはエージェントがユーザーに関する情報をやり取りをまたいで持続的に保持できるようにします。

エージェントの能動的な思考やメモ帳のようなものだと考えてください—ユーザーやタスクに関する重要な情報を常に手元に置いておく仕組みです。人が会話中に相手の名前や好み、重要な詳細を自然に覚えているのと似ています。

これは、常に関連し、エージェントが常時利用できるべき継続的な状態を維持するのに役立ちます。

ワーキングメモリは2つのスコープで保持できます:

* **スレッドスコープ**（デフォルト）：メモリは会話スレッドごとに分離されます
* **リソーススコープ**：同一ユーザーのすべての会話スレッド間でメモリが持続します

**重要:** スコープを切り替えると、もう一方のスコープのメモリはエージェントからは見えません—スレッドスコープのメモリはリソーススコープのメモリと完全に分離されています。

## クイックスタート \{#quick-start\}

作業メモリを備えたエージェントを設定する最小限の例は次のとおりです：

```typescript {12-15}
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';

// ワーキングメモリを有効にしてエージェントを作成
const agent = new Agent({
  name: 'PersonalAssistant',
  instructions: 'あなたは親切なパーソナルアシスタントです。',
  model: openai('gpt-4o'),
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
      },
    },
  }),
});
```

## 仕組み \{#how-it-works\}

Working memory は、エージェントが時間の経過とともに更新し、常に有用な情報を保管しておける Markdown 形式のテキストブロックです。

<YouTube id="UMy_JHLf1n8" />

## メモリの永続スコープ \{#memory-persistence-scopes\}

ワーキングメモリは2種類のスコープで動作し、会話間でのメモリの持続方法を選択できます。

### スレッド単位のメモリ（デフォルト） \{#thread-scoped-memory-default\}

デフォルトでは、ワーキングメモリは各会話スレッド単位で管理されます。各スレッドは、それぞれ独立したメモリを保持します。

```typescript
const memory = new Memory({
  storage,
  options: {
    workingMemory: {
      enabled: true,
      scope: 'thread', // デフォルト - メモリはスレッドごとに分離されます
      template: `# ユーザープロフィール
- **名前**:
- **興味・関心**:
- **現在の目標**:
`,
    },
  },
});
```

**ユースケース:**

* 別々のトピックについての個別の会話
* 一時的またはセッション固有の情報
* 各スレッドに作業用メモリが必要だが、スレッド自体は短命で互いに無関係なワークフロー

### リソーススコープのメモリ \{#resource-scoped-memory\}

リソーススコープのメモリは、同一ユーザー（resourceId）のすべての会話スレッド間で保持され、ユーザーに関する情報を永続的に記憶します。

```typescript
const memory = new Memory({
  storage,
  options: {
    workingMemory: {
      enabled: true,
      scope: 'resource', // メモリはすべてのユーザースレッド間で保持されます
      template: `# ユーザープロフィール
- **名前**:
- **場所**:
- **興味・関心**:
- **設定**:
- **長期目標**:
`,
    },
  },
});
```

**ユースケース：**

* ユーザーの好みを記憶するパーソナルアシスタント
* 顧客の状況を維持するカスタマーサービスボット
* 学習者の進捗を追跡する教育アプリ

### エージェントでの使い方 \{#usage-with-agents\}

resource-scoped memory を使用する場合は、`resourceId` パラメータを必ず渡してください：

```typescript
// リソーススコープのメモリにはresourceIdが必要です
const response = await agent.generate('Hello!', {
  threadId: 'conversation-123',
  resourceId: 'user-alice-456', // 複数のスレッドで同一ユーザーを識別
});
```

## ストレージアダプターのサポート \{#storage-adapter-support\}

リソーススコープのワーキングメモリには、`mastra_resources` テーブルに対応した特定のストレージアダプターが必要です。

### 対応ストレージアダプター \{#supported-storage-adapters\}

* **LibSQL** (`@mastra/libsql`)
* **PostgreSQL** (`@mastra/pg`)
* **Upstash** (`@mastra/upstash`)

## カスタムテンプレート \{#custom-templates\}

テンプレートは、エージェントが作業メモリでどの情報を追跡・更新するかの指針になります。テンプレートを指定しない場合はデフォルトのテンプレートが使用されますが、通常はエージェントの具体的なユースケースに合わせてカスタムテンプレートを定義し、最も重要な情報を確実に記憶できるようにします。

以下はカスタムテンプレートの例です。この例では、ユーザーが該当情報を含むメッセージを送信した時点で、エージェントはユーザーの名前、所在地、タイムゾーンなどを保存します。

```typescript {5-28}
const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      template: `
# ユーザープロフィール

## 個人情報

- 氏名：
- 居住地：
- タイムゾーン：

##  preferences

- コミュニケーションスタイル：[例：フォーマル、カジュアル]
- プロジェクト目標：
- 主要な締め切り：
  - [締め切り 1]：[日付]
  - [締め切り 2]：[日付]

## セッションの状態

- 直近に議論したタスク：
- 未解決の質問：
  - [質問 1]
  - [質問 2]
`,
    },
  },
});
```

## 効果的なテンプレートの設計 \{#designing-effective-templates\}

よく構造化されたテンプレートは、エージェントが情報を解析・更新しやすくします。テンプレートは、アシスタントに常に最新化してほしい「短いフォーム」として扱いましょう。

* **短く、要点が伝わるラベルに。** 段落や長すぎる見出しは避けましょう。ラベルは簡潔に（例：
  `## Personal Info` や `- Name:`）しておくと、更新が読みやすく、途中で切り捨てられにくくなります。
* **大文字小文字の表記を統一する。** 不一致な大文字小文字（`Timezone:` と `timezone:`）は更新内容を乱します。見出しや箇条書きのラベルは Title Case か lower case のどちらかに統一しましょう。
* **プレースホルダーはシンプルに。** LLM が正しい箇所を埋めやすいように、`[e.g., Formal]` や `[Date]` のようなヒントを使いましょう。
* **長すぎる値は省略する。** 短い形式で十分な場合は、正式な全文ではなく、
  `- Name: [First name or nickname]` や `- Address (short):` のような指針を示しましょう。
* **更新ルールは `instructions` に明記する。** テンプレートのどの部分をいつ、どのように埋める／クリアするかを、エージェントの `instructions` フィールドに直接指示できます。

### 代替テンプレートのスタイル \{#alternative-template-styles\}

いくつかの項目だけでよい場合は、短い単一ブロックを使用してください:

```typescript
const basicMemory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      template: `ユーザー情報:\n- 名前:\n- 好きな色:\n- 現在の話題:`,
    },
  },
});
```

より物語的なスタイルを好む場合は、主要なポイントを短い段落形式でまとめることもできます。

```typescript
const paragraphMemory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      template: `重要な詳細:\n\nユーザーの重要な情報(名前、主な目標、現在のタスク)を簡潔な段落にまとめて保持してください。`,
    },
  },
});
```

## 構造化ワーキングメモリ \{#structured-working-memory\}

ワーキングメモリは、Markdown テンプレートの代わりに構造化スキーマで定義することもできます。これにより、追跡すべきフィールドと型を [Zod](https://zod.dev/) のスキーマで正確に指定できます。スキーマを用いる場合、エージェントはスキーマに準拠した JSON オブジェクトとしてワーキングメモリを参照・更新します。

**重要:** `template` または `schema` のどちらか一方を指定する必要があり、両方を同時に指定してはいけません。

### 例: スキーマベース作業記憶 \{#example-schema-based-working-memory\}

```typescript
import { z } from 'zod';
import { Memory } from '@mastra/memory';

const userProfileSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  timezone: z.string().optional(),
  preferences: z
    .object({
      communicationStyle: z.string().optional(),
      projectGoal: z.string().optional(),
      deadlines: z.array(z.string()).optional(),
    })
    .optional(),
});

const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      schema: userProfileSchema,
      // テンプレート: ...（設定しないこと）
    },
  },
});
```

スキーマが指定されている場合、エージェントは作業メモリを JSON オブジェクトとして受け取ります。例：

```json
{
  "name": "Sam",
  "location": "Berlin",
  "timezone": "CET",
  "preferences": {
    "communicationStyle": "丁寧",
    "projectGoal": "MVP をローンチ",
    "deadlines": ["2025-07-01"]
  }
}
```

## テンプレートとスキーマの選択 \{#choosing-between-template-and-schema\}

* エージェントにユーザープロファイルやスクラッチパッドのような自由形式のテキストブロックとしてメモリを保持させたい場合は、**テンプレート**（Markdown）を使用します。
* 検証可能で、JSONとしてプログラムからアクセスできる構造化かつ型安全なデータが必要な場合は、**スキーマ**を使用します。
* 有効化できるモードは同時に一つだけです。`template` と `schema` を同時に設定することはサポートされていません。

## 例：マルチステップのリテンション \{#example-multi-step-retention\}

以下は、短いユーザーとの会話の中で `User Profile` テンプレートがどのように更新されるかを示した簡略図です。

```nohighlight
# ユーザープロフィール

## 個人情報

- 名前:
- 居住地:
- タイムゾーン:

--- ユーザーが「私の名前は**Sam**で、**Berlin**から来ました」と言った後 ---

# ユーザープロフィール
- 名前: Sam
- 居住地: Berlin
- タイムゾーン:

--- ユーザーが「ちなみに、普段は**CET**です」と追加した後 ---

# ユーザープロフィール
- 名前: Sam
- 居住地: Berlin
- タイムゾーン: CET
```

エージェントは、作業メモリに保存されているため、以降の応答で `Sam` や `Berlin` を情報を再度求めることなく参照できます。

想定どおりにエージェントが作業メモリを更新しない場合は、エージェントの `instructions` 設定に、このテンプレートを「どのように」「いつ」使うかについてのシステム指示を追加できます。

## 初期ワーキングメモリの設定 \{#setting-initial-working-memory\}

エージェントは通常、`updateWorkingMemory` ツールでワーキングメモリを更新しますが、スレッドの作成や更新時に初期ワーキングメモリをプログラムから設定することもできます。これは、毎回のリクエストで渡さずにエージェントが参照できるようにしておきたいユーザーデータ（名前、好み、その他の情報など）をあらかじめ登録しておくのに役立ちます。

### スレッドのメタデータでワーキングメモリを設定する \{#setting-working-memory-via-thread-metadata\}

スレッドを作成する際、メタデータの `workingMemory` キーで初期ワーキングメモリを指定できます:

```typescript filename="src/app/medical-consultation.ts" showLineNumbers copy
// 初期ワーキングメモリ付きでスレッドを作成する
const thread = await memory.createThread({
  threadId: 'thread-123',
  resourceId: 'user-456',
  title: '医療相談',
  metadata: {
    workingMemory: `# 患者プロフィール
- 氏名: John Doe
- 血液型: O+
- アレルギー: ペニシリン
- 服用中の薬: なし
- 既往歴: 高血圧（コントロール良好）
`,
  },
});

// エージェントは以後すべてのメッセージでこの情報にアクセスできる
await agent.generate("私の血液型は何ですか？", {
  threadId: thread.id,
  resourceId: 'user-456',
});
// 応答: "あなたの血液型はO+です。"
```

### プログラムからワーキングメモリを更新する \{#updating-working-memory-programmatically\}

既存のスレッドのワーキングメモリも更新できます。

```typescript filename="src/app/medical-consultation.ts" showLineNumbers copy
// スレッドのメタデータを更新して作業メモリを追加/変更する
await memory.updateThread({
  id: 'thread-123',
  title: thread.title,
  metadata: {
    ...thread.metadata,
    workingMemory: `# 患者プロフィール
- 氏名: John Doe
- 血液型: O+
- アレルギー: ペニシリン、イブプロフェン  // 更新
- 内服薬: リシノプリル 10mg／日  // 追加
- 病歴: 高血圧（コントロール良好）
`,
  },
});
```

### メモリを直接更新 \{#direct-memory-update\}

別の方法として、`updateWorkingMemory` メソッドを直接使用します。

```typescript filename="src/app/medical-consultation.ts" showLineNumbers copy
await memory.updateWorkingMemory({
  threadId: 'thread-123',
  resourceId: 'user-456', // リソース単位のメモリでは必須
  workingMemory: 'メモリ内容を更新しました...',
});
```

## 例 \{#examples\}

* [基本的なワーキングメモリ](/docs/examples/memory/working-memory-basic)
* [テンプレートを用いたワーキングメモリ](/docs/examples/memory/working-memory-template)
* [スキーマを用いたワーキングメモリ](/docs/examples/memory/working-memory-schema)
* [リソースごとのワーキングメモリ](https://github.com/mastra-ai/mastra/tree/main/examples/memory-per-resource-example) - リソース単位のメモリ永続化を示す完全な例