---
title: "Memory.query() "
description: "Mastra の `Memory.query()` メソッドに関するドキュメント。ページネーション、フィルタリング、セマンティック検索に対応し、特定のスレッドからメッセージを取得します。"
---

# Memory.query() \{#memoryquery\}

`.query()` メソッドは、特定のスレッドからメッセージを取得します。ページネーション、フィルターオプション、セマンティック検索をサポートします。

## 使い方の例 \{#usage-example\}

```typescript copy
await memory?.query({ threadId: 'user-123' });
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "threadId",
type: "string",
description: "メッセージを取得する対象スレッドの一意の識別子",
isOptional: false,
},
{
name: "resourceId",
type: "string",
description: "スレッドの所有者であるリソースの任意指定のID。指定した場合はスレッドの所有権を検証します",
isOptional: true,
},
{
name: "selectBy",
type: "object",
description: "メッセージの絞り込みおよび選択のオプション",
isOptional: true,
},
{
name: "threadConfig",
type: "MemoryConfig",
description: "メッセージ取得およびセマンティック検索のための設定オプション",
isOptional: true,
},
{
name: "format",
type: "'v1' | 'v2'",
description: "返すメッセージ形式。現在の形式には「v2」がデフォルト、後方互換には「v1」",
isOptional: true,
},
]}
/>

### selectBy パラメータ \{#selectby-parameters\}

<PropertiesTable
  content={[
{
name: "vectorSearchString",
type: "string",
description: "意味的に類似するメッセージを検索するための文字列。threadConfig で semantic recall が有効になっている必要があります。",
isOptional: true,
},
{
name: "last",
type: "number | false",
description: "取得する直近メッセージ数。上限を無効化するには false を指定します。注: threadConfig.lastMessages（デフォルト: 10）がそれより小さい場合はそちらが優先されます。",
isOptional: true,
},
{
name: "include",
type: "{ id: string; threadId?: string; withPreviousMessages?: number; withNextMessages?: number }[]",
description: "必要に応じて前後のコンテキストを付けて含める特定メッセージ ID の配列。各要素には必須の `id`、任意の `threadId`（未指定時はメインの threadId）、`withPreviousMessages`（前に含めるメッセージ数。ベクター検索時のデフォルトは 2、それ以外は 0）、`withNextMessages`（後に含めるメッセージ数。ベクター検索時のデフォルトは 2、それ以外は 0）があります。",
isOptional: true,
},
{
name: "pagination",
type: "{ dateRange?: { start?: Date; end?: Date }; page?: number; perPage?: number }",
description: "メッセージを分割取得するためのページネーション設定。`dateRange`（日付範囲での絞り込み）、`page`（0 始まりのページ番号）、`perPage`（1 ページあたりのメッセージ数）を含みます。",
isOptional: true,
},
]}
/>

### threadConfig パラメータ \{#threadconfig-parameters\}

<PropertiesTable
  content={[
{
name: "lastMessages",
type: "number | false",
description: "取得する最新メッセージ数。無効にするには false を指定します。",
isOptional: true,
defaultValue: "10",
},
{
name: "semanticRecall",
type: "boolean | { topK: number; messageRange: number | { before: number; after: number }; scope?: 'thread' | 'resource' }",
description: "メッセージ履歴でのセマンティック検索を有効にします。真偽値または設定オプションを含むオブジェクトを指定できます。有効化するには、ベクターストアとエンベッダーの両方の設定が必要です。",
isOptional: true,
defaultValue: "false",
},
{
name: "workingMemory",
type: "WorkingMemory",
description: "Working Memory 機能の設定。`{ enabled: boolean; template?: string; schema?: ZodObject<any> | JSONSchema7; scope?: 'thread' | 'resource' }` または無効化用の `{ enabled: boolean }` を指定できます。",
isOptional: true,
defaultValue: "{ enabled: false, template: '# User Information\\n- **First Name**:\\n- **Last Name**:\\n...' }",
},
{
name: "threads",
type: "{ generateTitle?: boolean | { model: DynamicArgument<MastraLanguageModel>; instructions?: DynamicArgument<string> } }",
description: "メモリスレッド作成に関する設定。`generateTitle` は、ユーザーの最初のメッセージからスレッドタイトルを自動生成するかどうかを制御します。真偽値またはカスタムの model と instructions を含むオブジェクトを指定できます。",
isOptional: true,
defaultValue: "{ generateTitle: false }",
},
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "messages",
type: "CoreMessage[]",
description: "取得したメッセージをコア形式で格納した配列",
},
{
name: "uiMessages",
type: "UIMessageWithMetadata[]",
description: "UI 表示用に整形されたメッセージの配列。ツール呼び出しと結果の適切なスレッド化を含みます",
},
]}
/>

## 拡張的な使用例 \{#extended-usage-example\}

```typescript filename="src/test-memory.ts" showLineNumbers copy
import { mastra } from './mastra';

const agent = mastra.getAgent('agent');
const memory = await agent.getMemory();

const { messages, uiMessages } = await memory!.query({
  threadId: 'thread-123',
  selectBy: {
    last: 50,
    vectorSearchString: 'どんなメッセージがありますか?',
    include: [
      {
        id: 'msg-123',
      },
      {
        id: 'msg-456',
        withPreviousMessages: 3,
        withNextMessages: 1,
      },
    ],
  },
  threadConfig: {
    semanticRecall: true,
  },
});

console.log(messages);
console.log(uiMessages);
```

### 関連 \{#related\}

* [Memory クラスリファレンス](/docs/reference/memory)
* [Memory の始め方](/docs/memory/overview)
* [セマンティックリコール](/docs/memory/semantic-recall)
* [createThread](/docs/reference/memory/createThread)