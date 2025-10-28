---
title: "Unicode Normalizer"
description: "Mastra の UnicodeNormalizer のドキュメント。Unicode テキストを正規化し、表記を統一して、問題の原因になりうる文字を除去します。"
---

# UnicodeNormalizer \{#unicodenormalizer\}

`UnicodeNormalizer` は、メッセージが言語モデルに送信される前に Unicode テキストを正規化し、書式の一貫性を保つとともに潜在的に問題のある文字を除去するための**入力プロセッサ**です。このプロセッサは、さまざまな Unicode 表現の取り扱い、制御文字の削除、空白の整形の標準化を行うことで、テキスト品質の維持に貢献します。

## 使い方の例 \{#usage-example\}

```typescript copy
import { UnicodeNormalizer } from '@mastra/core/processors';

const processor = new UnicodeNormalizer({
  stripControlChars: true,     // 制御文字を削除
  collapseWhitespace: true,   // 空白をまとめる
});
```

## コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "Options",
description: "Unicode テキスト正規化の設定オプション",
isOptional: true,
},
]}
/>

### オプション \{#options\}

<PropertiesTable
  content={[
{
name: "stripControlChars",
type: "boolean",
description: "制御文字を削除するかどうか。有効にすると、\t、\n、\r を除く制御文字を取り除きます",
isOptional: true,
default: "false",
},
{
name: "preserveEmojis",
type: "boolean",
description: "絵文字を保持するかどうか。無効にすると、制御文字を含む絵文字は削除される場合があります",
isOptional: true,
default: "true",
},
{
name: "collapseWhitespace",
type: "boolean",
description: "連続する空白をまとめるかどうか。有効にすると、複数のスペース／タブ／改行を単一のものにまとめます",
isOptional: true,
default: "true",
},
{
name: "trim",
type: "boolean",
description: "前後の空白を削除（トリム）するかどうか",
isOptional: true,
default: "true",
},
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "プロセッサ名。'unicode-normalizer' に設定されます",
isOptional: false,
},
{
name: "processInput",
type: "(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never }) => MastraMessageV2[]",
description: "Unicode テキストを正規化するために入力メッセージを処理します。",
isOptional: false,
},
]}
/>

## 拡張的な使用例 \{#extended-usage-example\}

```typescript filename="src/mastra/agents/normalized-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { UnicodeNormalizer } from '@mastra/core/processors';

export const agent = new Agent({
  name: 'normalized-agent',
  instructions: 'あなたは頼りになるアシスタントです',
  model: openai('gpt-4o-mini'),
  inputProcessors: [
    new UnicodeNormalizer({
      stripControlChars: true,
      preserveEmojis: true,
      collapseWhitespace: true,
      trim: true,
    }),
  ],
});
```

## 関連情報 \{#related\}

* [入力プロセッサー](/docs/agents/guardrails)