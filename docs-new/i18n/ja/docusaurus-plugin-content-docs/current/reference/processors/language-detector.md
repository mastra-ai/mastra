---
title: "リファレンス: Language Detector"
description: "Mastra の LanguageDetector に関するドキュメント。言語を検出し、AI の応答内のコンテンツを翻訳できます。"
---

# LanguageDetector \{#languagedetector\}

`LanguageDetector` は、入力テキストの言語を特定し、必要に応じてターゲット言語へ翻訳して、処理の一貫性を保つための**入力プロセッサ**です。このプロセッサは、受信メッセージの言語を検出し、すべてのコンテンツがターゲット言語で処理されるよう自動翻訳を含む柔軟な多言語対応戦略を提供することで、言語の一貫性を維持します。

## 使い方の例 \{#usage-example\}

```typescript copy
import { openai } from '@ai-sdk/openai';
import { LanguageDetector } from '@mastra/core/processors';

const processor = new LanguageDetector({
  model: openai('gpt-4.1-nano'),
  targetLanguages: ['日本語', 'ja'],
  threshold: 0.8,
  strategy: '翻訳',
});
```

## コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "Options",
description: "言語検出と翻訳のための構成オプション",
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
description: "検出/翻訳エージェントのモデル設定",
isOptional: false,
},
{
name: "targetLanguages",
type: "string[]",
description: "プロジェクトの対象言語。コンテンツが別の言語と判定された場合、翻訳されることがあります。言語名（'English'）または ISO コード（'en'）を使用できます",
isOptional: true,
default: "['English', 'en']",
},
{
name: "threshold",
type: "number",
description: "言語検出の信頼度しきい値（0〜1）。検出の信頼度がこのしきい値を超えた場合にのみ処理します",
isOptional: true,
default: "0.7",
},
{
name: "strategy",
type: "'detect' | 'translate' | 'block' | 'warn'",
description: "対象外の言語が検出された場合の方針: 'detect' は検出のみ、'translate' は自動で対象言語に翻訳、'block' は対象言語以外のコンテンツを拒否、'warn' は警告を記録して許可します",
isOptional: true,
default: "'detect'",
},
{
name: "preserveOriginal",
type: "boolean",
description: "元のコンテンツをメッセージのメタデータに保持するかどうか。監査ログやデバッグに有用です",
isOptional: true,
default: "true",
},
{
name: "instructions",
type: "string",
description: "エージェント向けのカスタム検出手順。未指定の場合はデフォルトの手順を使用します",
isOptional: true,
default: "undefined",
},
{
name: "minTextLength",
type: "number",
description: "検出を実行する最小テキスト長。短いテキストは言語検出の信頼性が低いことがよくあります",
isOptional: true,
default: "10",
},
{
name: "includeDetectionDetails",
type: "boolean",
description: "ログに詳細な検出情報を含めるかどうか",
isOptional: true,
default: "false",
},
{
name: "translationQuality",
type: "'speed' | 'quality' | 'balanced'",
description: "翻訳品質の優先度: 'speed' は速度を優先、'quality' は正確性を優先、'balanced' は速度と品質のバランスを取ります",
isOptional: true,
default: "'quality'",
},
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "プロセッサー名。'language-detector' に設定されます",
isOptional: false,
},
{
name: "processInput",
type: "(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never; tracingContext?: TracingContext }) => Promise<MastraMessageV2[]>",
description: "入力メッセージを処理して言語を検出し、必要に応じて LLM に送信する前に内容を翻訳します",
isOptional: false,
},
]}
/>

## 応用例 \{#extended-usage-example\}

```typescript filename="src/mastra/agents/multilingual-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { LanguageDetector } from '@mastra/core/processors';

export const agent = new Agent({
  name: 'multilingual-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: openai('gpt-4o-mini'),
  inputProcessors: [
    new LanguageDetector({
      model: openai('gpt-4.1-nano'),
      targetLanguages: ['English', 'en'],
      threshold: 0.8,
      strategy: 'translate',
      preserveOriginal: true,
      instructions: '言語を検出し、元の意図を保ちながら英語以外のコンテンツを英語に翻訳します',
      minTextLength: 10,
      includeDetectionDetails: true,
      translationQuality: 'quality',
    }),
  ],
});
```

## 関連項目 \{#related\}

* [入力プロセッサ](/docs/agents/guardrails)