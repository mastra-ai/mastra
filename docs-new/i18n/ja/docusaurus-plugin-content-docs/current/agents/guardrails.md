---
title: "ガードレール"
description: "入力・出力プロセッサを使ったガードレールの実装方法を学び、AI との対話を安全かつ適切に制御します。"
sidebar_position: 5
---

# ガードレール \{#guardrails\}

エージェントはプロセッサを用いて、入力と出力にガードレールを適用します。これらは各インタラクションの前後に実行され、ユーザーとエージェント間を行き来する情報を審査・変換・ブロックする手段を提供します。

プロセッサは次のように設定できます:

* **`inputProcessors`**: メッセージが言語モデルに到達する前に適用されます。
* **`outputProcessors`**: 応答がユーザーに返される前に適用されます。

一部のプロセッサは&#95;ハイブリッド&#95;で、ロジックをどこに適用するかに応じて、`inputProcessors` または `outputProcessors` のいずれかとして使用できます。

## プロセッサを使うタイミング \{#when-to-use-processors\}

プロセッサは、コンテンツモデレーション、プロンプトインジェクションの防止、レスポンスのサニタイズ、メッセージ変換、その他のセキュリティ関連の制御に使用します。Mastra には、一般的なユースケースに対応する組み込みの入出力プロセッサが複数用意されています。

## エージェントにプロセッサを追加する \{#adding-processors-to-an-agent\}

対象のプロセッサクラスをインポートしてインスタンス化し、`inputProcessors` または `outputProcessors` パラメータを使ってエージェントの設定に渡します。

```typescript {3,9-17} filename="src/mastra/agents/moderated-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { ModerationProcessor } from '@mastra/core/processors';

export const moderatedAgent = new Agent({
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
    }),
  ],
});
```

## 入力プロセッサ \{#input-processors\}

入力プロセッサは、ユーザーのメッセージが言語モデルに届く前に適用されます。正規化、検証、コンテンツのモデレーション、プロンプトインジェクションの検出、セキュリティチェックなどに役立ちます。

### ユーザーメッセージの正規化 \{#normalizing-user-messages\}

`UnicodeNormalizer` は、Unicode 文字の統一、空白の標準化、問題のある記号の除去によってユーザー入力を整形・正規化する入力プロセッサであり、LLM がユーザーメッセージをより正確に理解できるようにします。

```typescript {6-9} filename="src/mastra/agents/normalized-agent.ts" showLineNumbers copy
import { UnicodeNormalizer } from '@mastra/core/processors';

export const normalizedAgent = new Agent({
  // ...
  inputProcessors: [
    new UnicodeNormalizer({
      stripControlChars: true,
      collapseWhitespace: true,
    }),
  ],
});
```

> 設定オプションの一覧については、[UnicodeNormalizer](/docs/reference/processors/unicode-normalizer) を参照してください。

### プロンプトインジェクションの防止 \{#preventing-prompt-injection\}

`PromptInjectionDetector` は、ユーザーからのメッセージをスキャンし、プロンプトインジェクションやジェイルブレイクの試み、システムの上書きパターンを検出する入力プロセッサです。LLM を用いてリスクの高い入力を分類し、モデルに渡る前にブロックしたり書き換えたりできます。

```typescript {6-11} filename="src/mastra/agents/secure-agent.ts" showLineNumbers copy
import { PromptInjectionDetector } from '@mastra/core/processors';

export const secureAgent = new Agent({
  // ...
  inputProcessors: [
    new PromptInjectionDetector({
      model: openai('gpt-4.1-nano'),
      threshold: 0.8,
      strategy: 'rewrite',
      detectionTypes: ['injection', 'jailbreak', 'system-override'],
    }),
  ],
});
```

> 設定オプションの全リストは [PromptInjectionDetector](/docs/reference/processors/prompt-injection-detector) を参照してください。

### 言語の検出と翻訳 \{#detecting-and-translating-language\}

`LanguageDetector` は、ユーザーのメッセージの言語を検出して対象言語に翻訳する入力プロセッサで、一貫した対話を保ちながら多言語対応を実現します。LLM を用いて言語を判別し、翻訳を行います。

```typescript {6-11} filename="src/mastra/agents/multilingual-agent.ts" showLineNumbers copy
import { LanguageDetector } from '@mastra/core/processors';

export const multilingualAgent = new Agent({
  // ...
  inputProcessors: [
    new LanguageDetector({
      model: openai('gpt-4.1-nano'),
      targetLanguages: ['English', 'en'],
      strategy: 'translate',
      threshold: 0.8,
    }),
  ],
});
```

> 設定オプションの一覧については、[LanguageDetector](/docs/reference/processors/language-detector) を参照してください。

## 出力プロセッサ \{#output-processors\}

出力プロセッサは、言語モデルが応答を生成した後、ユーザーに返す前の段階で適用されます。応答の最適化、モデレーション、変換、安全対策の適用などに有用です。

### ストリーム出力のバッチ処理 \{#batching-streamed-output\}

`BatchPartsProcessor` は、クライアントへ送信する前に複数のストリーム片をまとめてから出力するプロセッサです。これにより、ネットワークのオーバーヘッドを抑え、小さなチャンクをより大きなバッチにまとめることでユーザー体験が向上します。

```typescript {6-10} filename="src/mastra/agents/batched-agent.ts" showLineNumbers copy
import { BatchPartsProcessor } from '@mastra/core/processors';

export const batchedAgent = new Agent({
  // ...
  outputProcessors: [
    new BatchPartsProcessor({
      batchSize: 5,
      maxWaitTime: 100,
      emitOnNonText: true,
    }),
  ],
});
```

> 設定オプションの全一覧は [BatchPartsProcessor](/docs/reference/processors/batch-parts-processor) を参照してください。

### トークン使用量の制限 \{#limiting-token-usage\}

`TokenLimiterProcessor` は、モデルの応答に含まれるトークン数を制限する出力プロセッサです。上限を超えた場合にメッセージを切り詰めたり、ブロックしたりすることで、コストとパフォーマンスの管理に役立ちます。

```typescript {6-10, 13-15} filename="src/mastra/agents/limited-agent.ts" showLineNumbers copy
import { TokenLimiterProcessor } from '@mastra/core/processors';

export const limitedAgent = new Agent({
  // ...
  outputProcessors: [
    new TokenLimiterProcessor({
      limit: 1000,
      strategy: 'truncate',
      countMode: 'cumulative',
    }),
  ],
});
```

> 設定オプションの全一覧については、[TokenLimiterProcessor](/docs/reference/processors/token-limiter-processor) を参照してください。

### システムプロンプトのスクラビング \{#scrubbing-system-prompts\}

`SystemPromptScrubber` は、モデルの応答からシステムプロンプトやその他の内部指示を検出して伏せ字化（マスキング）する出力プロセッサです。これにより、セキュリティリスクになり得るプロンプト内容や設定の詳細が意図せず開示されるのを防げます。設定された検出タイプに基づいて機微な内容を特定し、伏せ字化するために LLM を使用します。

```typescript {5-13} filename="src/mastra/agents/scrubbed-agent.ts" copy showLineNumbers
import { SystemPromptScrubber } from '@mastra/core/processors';

const scrubbedAgent = new Agent({
  outputProcessors: [
    new SystemPromptScrubber({
      model: openai('gpt-4.1-nano'),
      strategy: '編集',
      customPatterns: ['system prompt', 'internal instructions'],
      includeDetections: true,
      instructions: 'システムプロンプト、内部指示、およびセキュリティ機微なコンテンツを検出して編集する',
      redactionMethod: 'プレースホルダー',
      placeholderText: '[編集済み]',
    }),
  ],
});
```

> 設定オプションの全リストは [SystemPromptScrubber](/docs/reference/processors/system-prompt-scrubber) を参照してください。

## ハイブリッドプロセッサ \{#hybrid-processors\}

ハイブリッドプロセッサは、メッセージを言語モデルに送る前、またはユーザーに応答を返す前に適用できます。コンテンツモデレーションやPIIの編集（マスキング）などのタスクに有用です。

### 入出力のモデレーション \{#moderating-input-and-output\}

`ModerationProcessor` は、憎悪表現、ハラスメント、暴力などの各カテゴリにわたり、不適切または有害なコンテンツを検出するハイブリッド型のプロセッサです。適用する位置に応じて、ユーザーの入力またはモデルの出力のいずれかをモデレートできます。LLM を用いてメッセージを分類し、設定に基づいてブロックしたり書き換えたりできます。

```typescript {6-11, 14-16} filename="src/mastra/agents/moderated-agent.ts" showLineNumbers copy
import { ModerationProcessor } from '@mastra/core/processors';

export const moderatedAgent = new Agent({
  // ...
  inputProcessors: [
    new ModerationProcessor({
      model: openai('gpt-4.1-nano'),
      threshold: 0.7,
      strategy: 'block',
      categories: ['ヘイト', 'ハラスメント', '暴力'],
    }),
  ],
  outputProcessors: [
    new ModerationProcessor({
      // ...
    }),
  ],
});
```

> 設定オプションの全一覧は、[ModerationProcessor](/docs/reference/processors/moderation-processor)を参照してください。

### PII の検出とマスキング \{#detecting-and-redacting-pii\}

`PIIDetector` は、メールアドレス、電話番号、クレジットカード番号などの個人を特定できる情報（PII）を検出して除去するハイブリッドのプロセッサです。適用する位置に応じて、ユーザー入力またはモデル出力のいずれかをマスキングできます。設定された検出タイプに基づき、LLM を用いて機微な内容を特定します。

```typescript {6-13, 16-18} filename="src/mastra/agents/private-agent.ts" showLineNumbers copy
import { PIIDetector } from '@mastra/core/processors';

export const privateAgent = new Agent({
  // ...
  inputProcessors: [
    new PIIDetector({
      model: openai('gpt-4.1-nano'),
      threshold: 0.6,
      strategy: 'redact',
      redactionMethod: 'mask',
      detectionTypes: ['email', 'phone', 'credit-card'],
      instructions: '個人を特定できる情報を検出してマスクすること。',
    }),
  ],
  outputProcessors: [
    new PIIDetector({
      // ...
    }),
  ],
});
```

> 設定オプションの全一覧については、[PIIDetector](/docs/reference/processors/pii-detector) を参照してください。

## 複数のプロセッサの適用 \{#applying-multiple-processors\}

`inputProcessors` または `outputProcessors` 配列に列挙することで、複数のプロセッサを適用できます。プロセッサは順番に実行され、各プロセッサは直前の処理結果を受け取ります。

一般的な順序の例:

1. **正規化**: 入力形式を統一する（`UnicodeNormalizer`）。
2. **セキュリティチェック**: 脅威や機微情報を検出する（`PromptInjectionDetector`、`PIIDetector`）。
3. **フィルタリング**: メッセージをブロックまたは変換する（`ModerationProcessor`）。

順序は動作に影響するため、目的に合わせてプロセッサを並べてください。

```typescript filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { UnicodeNormalizer, ModerationProcessor, PromptInjectionDetector, PIIDetector } from '@mastra/core/processors';

export const testAgent = new Agent({
  // ...
  inputProcessors: [
    new UnicodeNormalizer({
      // ...
    }),
    new PromptInjectionDetector({
      // ...
    }),
    new PIIDetector({
      // ...
    }),
    new ModerationProcessor({
      // ...
    }),
  ],
});
```

## プロセッサの戦略 \{#processor-strategies\}

多くの組み込みプロセッサは、フラグが付いた入力や出力をどのように処理するかを制御する `strategy` パラメータをサポートしています。サポートされる値には `block`、`warn`、`detect`、`redact` などが含まれる場合があります。

ほとんどの戦略では、リクエストは中断されることなく続行されます。`block` が使用されると、プロセッサは内部の `abort()` 関数を呼び出し、リクエストを即時に停止して、以降のプロセッサが実行されるのを防ぎます。

```typescript {8} filename="src/mastra/agents/private-agent.ts" showLineNumbers copy
import { PIIDetector } from '@mastra/core/processors';

export const privateAgent = new Agent({
  // ...
  inputProcessors: [
    new PIIDetector({
      // ...
      strategy: 'block',
    }),
  ],
});
```

### ブロックされたリクエストの扱い \{#handling-blocked-requests\}

プロセッサがリクエストをブロックしても、エージェントはエラーをスローせず正常に応答します。ブロックされたリクエストを処理するには、レスポンス内の `tripwire` または `tripwireReason` を確認してください。

たとえば、エージェントが `strategy: "block"` を指定した `PIIDetector` を使用しており、リクエストにクレジットカード番号が含まれている場合、そのリクエストはブロックされ、レスポンスには `tripwireReason` が含まれます。

#### `.generate()` の使用例 \{#generate-example\}

```typescript {3-4, } showLineNumbers
const result = await agent.generate('このクレジットカード番号は有効ですか: 4543 1374 5089 4332');

console.error(result.tripwire);
console.error(result.tripwireReason);
```

#### `.stream()` の使用例 \{#stream-example\}

```typescript {4-5} showLineNumbers
const stream = await agent.stream('このクレジットカード番号は有効ですか？ 4543 1374 5089 4332');

for await (const chunk of stream.fullStream) {
  if (chunk.type === 'tripwire') {
    console.error(chunk.payload.tripwireReason);
  }
}
```

この場合、`tripwireReason` はクレジットカード番号が検出されたことを示します。

```text
個人情報を検出しました。種類：クレジットカード
```
