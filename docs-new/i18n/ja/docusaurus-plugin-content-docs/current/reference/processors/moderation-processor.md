---
title: "リファレンス: Moderation Processor"
description: "Mastra の ModerationProcessor に関するドキュメント。LLM を使用して、複数カテゴリにわたる不適切コンテンツを検出し、モデレーションを提供します。"
---

# ModerationProcessor \{#moderationprocessor\}

`ModerationProcessor` は、入力と出力の両方の処理に使える**ハイブリッド型プロセッサ**で、LLM を用いて複数のカテゴリにわたり不適切なコンテンツを検出し、モデレーションを行います。このプロセッサは、設定可能なモデレーションカテゴリに基づいてメッセージを評価し、フラグ対象となったコンテンツの取り扱いに柔軟な戦略を適用することで、コンテンツの安全性維持に寄与します。

## 使い方の例 \{#usage-example\}

```typescript copy
import { openai } from '@ai-sdk/openai';
import { ModerationProcessor } from '@mastra/core/processors';

const processor = new ModerationProcessor({
  model: openai('gpt-4.1-nano'),
  threshold: 0.7,
  strategy: 'block',
  categories: ['hate', 'harassment', 'violence'],
});
```

## コンストラクターの引数 \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "Options",
description: "コンテンツモデレーション用の設定",
isOptional: false,
},
]}
/>

### オプション \{#options\}

<PropertiesTable
  content={[
{
name: "model",
type: "MastraLanguageModel",
description: "モデレーションエージェントのモデル設定",
isOptional: false,
},
{
name: "categories",
type: "string[]",
description: "モデレーション対象としてチェックするカテゴリ。指定がない場合は、OpenAI のデフォルトカテゴリを使用します",
isOptional: true,
default: "['hate', 'hate/threatening', 'harassment', 'harassment/threatening', 'self-harm', 'self-harm/intent', 'self-harm/instructions', 'sexual', 'sexual/minors', 'violence', 'violence/graphic']",
},
{
name: "threshold",
type: "number",
description: "フラグ付けのための信頼度しきい値（0〜1）。いずれかのカテゴリのスコアがこのしきい値を超えると、コンテンツはフラグ付けされます",
isOptional: true,
default: "0.5",
},
{
name: "strategy",
type: "'block' | 'warn' | 'filter'",
description: "コンテンツがフラグ付けされた場合の戦略。'block' はエラーで拒否、'warn' は警告を記録して通過させ、'filter' は該当メッセージを削除します",
isOptional: true,
default: "'block'",
},
{
name: "instructions",
type: "string",
description: "エージェント向けのカスタムモデレーション指示。指定がない場合は、カテゴリに基づくデフォルトの指示を使用します",
isOptional: true,
default: "undefined",
},
{
name: "includeScores",
type: "boolean",
description: "ログに信頼度スコアを含めるかどうか。しきい値の調整やデバッグに有用です",
isOptional: true,
default: "false",
},
{
name: "chunkWindow",
type: "number",
description: "ストリームのチャンクをモデレートする際、文脈として含める直前のチャンク数。1 に設定すると直前の部分を含めます",
isOptional: true,
default: "0（コンテキストウィンドウなし）",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "プロセッサ名は「moderation」に設定",
isOptional: false,
},
{
name: "processInput",
type: "(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never; tracingContext?: TracingContext }) => Promise<MastraMessageV2[]>",
description: "LLM に送信する前のコンテンツ審査のために入力メッセージを処理します",
isOptional: false,
},
{
name: "processOutputStream",
type: "(args: { part: ChunkType; streamParts: ChunkType[]; state: Record<string, any>; abort: (reason?: string) => never; tracingContext?: TracingContext }) => Promise<ChunkType | null | undefined>",
description: "配信中のコンテンツ審査のためにストリーミング出力の各パートを処理します",
isOptional: false,
},
]}
/>

## 応用的な使用例 \{#extended-usage-example\}

```typescript filename="src/mastra/agents/moderated-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { ModerationProcessor } from '@mastra/core/processors';

export const agent = new Agent({
  name: 'moderated-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: openai('gpt-4o-mini'),
  inputProcessors: [
    new ModerationProcessor({
      model: openai('gpt-4.1-nano'),
      categories: ['hate', 'harassment', 'violence'],
      threshold: 0.7,
      strategy: 'block',
      instructions: 'ユーザーメッセージ内の不適切なコンテンツを検出し、フラグを立てます',
      includeScores: true,
      chunkWindow: 1,
    }),
  ],
});
```

## 関連項目 \{#related\}

* [入力プロセッサ](/docs/agents/guardrails)
* [出力プロセッサ](/docs/agents/guardrails)