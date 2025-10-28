---
title: "リファレンス：PII Detector"
description: "Mastra の PIIDetector に関するドキュメント。AI の応答から、個人を特定できる情報（PII）を検出してマスキング（秘匿化）します。"
---

# PIIDetector \{#piidetector\}

`PIIDetector` は、プライバシー順守のために個人特定情報（PII）を検出・秘匿化する目的で、入力処理と出力処理の双方に利用できる**ハイブリッドプロセッサ**です。このプロセッサは、さまざまな種類の PII を特定し、それらへの対処に柔軟な戦略を提供することでプライバシー保護を支援します。また、GDPR、CCPA、HIPAA などのプライバシー規制への順守を確実にするための複数のマスキング（編集）手法も備えています。

## 使い方の例 \{#usage-example\}

```typescript copy
import { openai } from '@ai-sdk/openai';
import { PIIDetector } from '@mastra/core/processors';

const processor = new PIIDetector({
  model: openai('gpt-4.1-nano'),
  threshold: 0.6,
  strategy: 'redact',
  detectionTypes: ['email', 'phone', 'credit-card', 'ssn'],
});
```

## コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "Options",
description: "PII の検出とマスキングのための設定オプション",
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
description: "検出エージェントのモデル設定",
isOptional: false,
},
{
name: "detectionTypes",
type: "string[]",
description: "検出する PII の種類。未指定の場合はデフォルトの種類を使用します",
isOptional: true,
default: "['email', 'phone', 'credit-card', 'ssn', 'api-key', 'ip-address', 'name', 'address', 'date-of-birth', 'url', 'uuid', 'crypto-wallet', 'iban']",
},
{
name: "threshold",
type: "number",
description: "フラグ付けの信頼度しきい値 (0〜1)。いずれかのカテゴリのスコアがこのしきい値を超えると、PII としてフラグ付けされます",
isOptional: true,
default: "0.6",
},
{
name: "strategy",
type: "'block' | 'warn' | 'filter' | 'redact'",
description: "PII 検出時の動作方針: 'block' はエラーで拒否、'warn' は警告を記録して通過、'filter' はフラグ付けされたメッセージを除去、'redact' は PII をマスク済みの表現に置換",
isOptional: true,
default: "'redact'",
},
{
name: "redactionMethod",
type: "'mask' | 'hash' | 'remove' | 'placeholder'",
description: "PII のマスキング方法: 'mask' はアスタリスクで置換、'hash' は SHA256 ハッシュで置換、'remove' は完全に削除、'placeholder' は種類名のプレースホルダーで置換",
isOptional: true,
default: "'mask'",
},
{
name: "instructions",
type: "string",
description: "エージェント向けのカスタム検出手順。未指定の場合は、検出種類に基づくデフォルト手順を使用します",
isOptional: true,
default: "undefined",
},
{
name: "includeDetections",
type: "boolean",
description: "ログに検出の詳細を含めるかどうか。コンプライアンス監査やデバッグに有用です",
isOptional: true,
default: "false",
},
{
name: "preserveFormat",
type: "boolean",
description: "マスキング時に PII の書式を保持するかどうか。true の場合、電話番号の **\*-**-1234 のような構造を維持します",
isOptional: true,
default: "true",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "プロセッサ名は 'pii-detector' に設定されています",
isOptional: false,
},
{
name: "processInput",
type: "(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never; tracingContext?: TracingContext }) => Promise<MastraMessageV2[]>",
description: "LLM に送信する前に、入力メッセージ内の PII を検出してマスキングします",
isOptional: false,
},
{
name: "processOutputStream",
type: "(args: { part: ChunkType; streamParts: ChunkType[]; state: Record<string, any>; abort: (reason?: string) => never; tracingContext?: TracingContext }) => Promise<ChunkType | null | undefined>",
description: "ストリーミング中に、出力の各パート内の PII を検出してマスキングします",
isOptional: false,
},
]}
/>

## 応用例（拡張） \{#extended-usage-example\}

```typescript filename="src/mastra/agents/private-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { PIIDetector } from '@mastra/core/processors';

export const agent = new Agent({
  name: 'private-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: openai('gpt-4o-mini'),
  inputProcessors: [
    new PIIDetector({
      model: openai('gpt-4.1-nano'),
      detectionTypes: ['email', 'phone', 'credit-card', 'ssn'],
      threshold: 0.6,
      strategy: 'redact',
      redactionMethod: 'mask',
      instructions: '個人を特定できる情報を検出して秘匿化し、メッセージの意図を保持します',
      includeDetections: true,
      preserveFormat: true,
    }),
  ],
});
```

## 関連項目 \{#related\}

* [入力プロセッサ](/docs/agents/guardrails)
* [出力プロセッサ](/docs/agents/guardrails)