---
title: "ツール呼び出しの精度"
description: 特定のタスクに対して LLM が適切なツールを選択できているかを評価するために、Tool Call Accuracy スコアラーを用いる例。
---

# ツール呼び出し精度スコアラーの例 \{#tool-call-accuracy-scorer-examples\}

Mastra には、ツール呼び出し精度を評価するスコアラーが次の 2 種類あります：

* 決定論的評価向けの**コードベース・スコアラー**
* セマンティック評価向けの**LLM ベース・スコアラー**

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

> API の完全なドキュメントと設定オプションについては、[`Tool Call Accuracy Scorers`](/docs/reference/scorers/tool-call-accuracy)をご覧ください。

## コードベースのスコアラーの例 \{#code-based-scorer-examples\}

コードベースのスコアラーは、ツールの完全一致に基づいて、決定的な二値スコア（0または1）を返します。

### 取り込み \{#import\}

```typescript
import { createToolCallAccuracyScorerCode } from '@mastra/evals/scorers/code';
import { createAgentTestRun, createUIMessage, createToolInvocation } from '@mastra/evals/scorers/utils';
```

### 適切なツールの選択 \{#correct-tool-selection\}

```typescript filename="src/example-correct-tool.ts" showLineNumbers copy
const scorer = createToolCallAccuracyScorerCode({
  expectedTool: 'weather-tool',
});

// ツール呼び出しを含むLLM入出力のシミュレーション
const inputMessages = [
  createUIMessage({
    content: '今日のニューヨークの天気はどうですか?',
    role: 'user',
    id: 'input-1',
  }),
];

const output = [
  createUIMessage({
    content: '天気を確認しますね。',
    role: 'assistant',
    id: 'output-1',
    toolInvocations: [
      createToolInvocation({
        toolCallId: 'call-123',
        toolName: 'weather-tool',
        args: { location: 'New York' },
        result: { temperature: '72°F', condition: 'sunny' },
        state: 'result',
      }),
    ],
  }),
];

const run = createAgentTestRun({ inputMessages, output });
const result = await scorer.run(run);

console.log(result.score); // 1
console.log(result.preprocessStepResult?.correctToolCalled); // true
```

### 厳密モードでの評価 \{#strict-mode-evaluation\}

ちょうど1つのツールが呼び出された場合にのみ合格します:

```typescript filename="src/example-strict-mode.ts" showLineNumbers copy
const strictScorer = createToolCallAccuracyScorerCode({
  expectedTool: 'weather-tool',
  strictMode: true,
});

// 複数のツールが呼び出された - 厳密モードでは失敗します
const output = [
  createUIMessage({
    content: 'お手伝いします。',
    role: 'assistant',
    id: 'output-1',
    toolInvocations: [
      createToolInvocation({
        toolCallId: 'call-1',
        toolName: 'search-tool',
        args: {},
        result: {},
        state: 'result',
      }),
      createToolInvocation({
        toolCallId: 'call-2',
        toolName: 'weather-tool',
        args: { location: 'New York' },
        result: { temperature: '20°C' },
        state: 'result',
      }),
    ],
  }),
];

const result = await strictScorer.run(run);
console.log(result.score); // 0 - 複数のツールが呼び出されたため失敗します
```

### ツールの順序検証 \{#tool-order-validation\}

ツールが特定の順序で呼び出されているかを検証します:

```typescript filename="src/example-order-validation.ts" showLineNumbers copy
const orderScorer = createToolCallAccuracyScorerCode({
  expectedTool: 'auth-tool', // 順序指定時は無視されます
  expectedToolOrder: ['auth-tool', 'fetch-tool'],
  strictMode: true, // 追加ツールは不可
});

const output = [
  createUIMessage({
    content: '認証してデータを取得します。',
    role: 'assistant',
    id: 'output-1',
    toolInvocations: [
      createToolInvocation({
        toolCallId: 'call-1',
        toolName: 'auth-tool',
        args: { token: 'abc123' },
        result: { authenticated: true },
        state: 'result',
      }),
      createToolInvocation({
        toolCallId: 'call-2',
        toolName: 'fetch-tool',
        args: { endpoint: '/data' },
        result: { data: ['item1'] },
        state: 'result',
      }),
    ],
  }),
];

const result = await orderScorer.run(run);
console.log(result.score); // 1 - 正しい順序
```

### 柔軟な順序モード \{#flexible-order-mode\}

期待されるツールの相対的な順序が保たれている限り、追加のツールを許可します。

```typescript filename="src/example-flexible-order.ts" showLineNumbers copy
const flexibleOrderScorer = createToolCallAccuracyScorerCode({
  expectedTool: 'auth-tool',
  expectedToolOrder: ['auth-tool', 'fetch-tool'],
  strictMode: false, // 追加のツールを許可
});

const output = [
  createUIMessage({
    content: '包括的な操作を実行中です。',
    role: 'assistant',
    id: 'output-1',
    toolInvocations: [
      createToolInvocation({
        toolCallId: 'call-1',
        toolName: 'auth-tool',
        args: { token: 'abc123' },
        result: { authenticated: true },
        state: 'result',
      }),
      createToolInvocation({
        toolCallId: 'call-2',
        toolName: 'log-tool', // 追加のツール - フレキシブルモードでは問題なし
        args: { message: 'フェッチを開始' },
        result: { logged: true },
        state: 'result',
      }),
      createToolInvocation({
        toolCallId: 'call-3',
        toolName: 'fetch-tool',
        args: { endpoint: '/data' },
        result: { data: ['item1'] },
        state: 'result',
      }),
    ],
  }),
];

const result = await flexibleOrderScorer.run(run);
console.log(result.score); // 1 - auth-toolがfetch-toolより前に来る
```

## LLMベースのスコアラーの例 \{#llm-based-scorer-examples\}

LLMベースのスコアラーは、ユーザーの要求に対してツールの選択が適切かどうかをAIで評価します。

### 取り込み \{#import\}

```typescript
import { createToolCallAccuracyScorerLLM } from '@mastra/evals/scorers/llm';
import { openai } from '@ai-sdk/openai';
```

### LLM の基本的な評価 \{#basic-llm-evaluation\}

```typescript filename="src/example-llm-basic.ts" showLineNumbers copy
const llmScorer = createToolCallAccuracyScorerLLM({
  model: openai('gpt-4o-mini'),
  availableTools: [
    {
      name: 'weather-tool',
      description: '任意の場所の現在の天気情報を取得',
    },
    {
      name: 'calendar-tool',
      description: 'カレンダーのイベントや予定を確認',
    },
    {
      name: 'search-tool',
      description: '一般的な情報をウェブで検索',
    },
  ],
});

const inputMessages = [
  createUIMessage({
    content: '今日のサンフランシスコの天気は？',
    role: 'user',
    id: 'input-1',
  }),
];

const output = [
  createUIMessage({
    content: '現在の天気を確認しますね。',
    role: 'assistant',
    id: 'output-1',
    toolInvocations: [
      createToolInvocation({
        toolCallId: 'call-123',
        toolName: 'weather-tool',
        args: { location: 'San Francisco', date: 'today' },
        result: { temperature: '68°F', condition: 'foggy' },
        state: 'result',
      }),
    ],
  }),
];

const run = createAgentTestRun({ inputMessages, output });
const result = await llmScorer.run(run);

console.log(result.score); // 1.0 - 適切なツールの使用
console.log(result.reason); // "エージェントは、ユーザーの天気に関する依頼に対して weather-tool を正しく使用しました。"
```

### 不適切なツールの使用への対処 \{#handling-inappropriate-tool-usage\}

```typescript filename="src/example-llm-inappropriate.ts" showLineNumbers copy
const inputMessages = [
  createUIMessage({
    content: '東京の天気はどうですか？',
    role: 'user',
    id: 'input-1',
  }),
];

const inappropriateOutput = [
  createUIMessage({
    content: 'その情報を検索してみます。',
    role: 'assistant',
    id: 'output-1',
    toolInvocations: [
      createToolInvocation({
        toolCallId: 'call-456',
        toolName: 'search-tool', // weather-tool より不適切
        args: { query: '東京の天気' },
        result: { results: ['東京の天気データ...'] },
        state: 'result',
      }),
    ],
  }),
];

const run = createAgentTestRun({ inputMessages, output: inappropriateOutput });
const result = await llmScorer.run(run);

console.log(result.score); // 0.5 - 部分的に適切
console.log(result.reason); // "直接の天気問い合わせには weather-tool のほうが適切であるにもかかわらず、エージェントは search-tool を使用しました。"
```

### 確認・照会の要請を評価する \{#evaluating-clarification-requests\}

LLM スコアラーは、エージェントが適切に明確化を求めている場合を認識します。

```typescript filename="src/example-llm-clarification.ts" showLineNumbers copy
const vagueInput = [
  createUIMessage({
    content: '何か助けが必要です',
    role: 'user',
    id: 'input-1'
  })
];

const clarificationOutput = [
  createUIMessage({
    content: '喜んでお手伝いします。どのような点でお困りか、もう少し詳しく教えていただけますか？',
    role: 'assistant',
    id: 'output-1',
    // ツールは呼び出さず—代わりに明確化のための質問を実施
  })
];

const run = createAgentTestRun({
  inputMessages: vagueInput,
  output: clarificationOutput
});
const result = await llmScorer.run(run);

console.log(result.score); // 1.0 - 明確化を求めるのが適切
console.log(result.reason); // "エージェントは、情報が不十分な状態でツールを呼び出すのではなく、適切に明確化を求めました。"
```

## 両スコアラーの比較 \{#comparing-both-scorers\}

同じデータに対して両スコアラーを用いる例を以下に示します。

```typescript filename="src/example-comparison.ts" showLineNumbers copy
import { createToolCallAccuracyScorerCode as createCodeScorer } from '@mastra/evals/scorers/code';
import { createToolCallAccuracyScorerLLM as createLLMScorer } from '@mastra/evals/scorers/llm';
import { openai } from '@ai-sdk/openai';

// 両方のスコアラーをセットアップ
const codeScorer = createCodeScorer({
  expectedTool: 'weather-tool',
  strictMode: false,
});

const llmScorer = createLLMScorer({
  model: openai('gpt-4o-mini'),
  availableTools: [
    { name: 'weather-tool', description: '天気情報を取得' },
    { name: 'search-tool', description: 'ウェブを検索' },
  ],
});

// テストデータ
const run = createAgentTestRun({
  inputMessages: [
    createUIMessage({
      content: '天気はどうですか?',
      role: 'user',
      id: 'input-1',
    }),
  ],
  output: [
    createUIMessage({
      content: 'その情報を調べます。',
      role: 'assistant',
      id: 'output-1',
      toolInvocations: [
        createToolInvocation({
          toolCallId: 'call-1',
          toolName: 'search-tool',
          args: { query: 'weather' },
          result: { results: ['weather data'] },
          state: 'result',
        }),
      ],
    }),
  ],
});

// 両方のスコアラーを実行
const codeResult = await codeScorer.run(run);
const llmResult = await llmScorer.run(run);

console.log('Code Scorer:', codeResult.score); // 0 - 間違ったツール
console.log('LLM Scorer:', llmResult.score); // 0.3 - 部分的に適切
console.log('LLM Reason:', llmResult.reason); // search-toolがあまり適切でない理由を説明
```

## 設定オプション \{#configuration-options\}

### コードベースのスコアラー設定 \{#code-based-scorer-options\}

```typescript showLineNumbers copy
// 標準モード - 期待するツールが呼び出されれば合格
const lenientScorer = createCodeScorer({
  expectedTool: 'search-tool',
  strictMode: false,
});

// 厳格モード - ツールがちょうど1回だけ呼び出された場合にのみ合格
const strictScorer = createCodeScorer({
  expectedTool: 'search-tool',
  strictMode: true,
});

// 厳格モードでの順序チェック
const strictOrderScorer = createCodeScorer({
  expectedTool: 'step1-tool',
  expectedToolOrder: ['step1-tool', 'step2-tool', 'step3-tool'],
  strictMode: true, // 余分なツールは許可されない
});
```

### LLMベースのスコアリングオプション \{#llm-based-scorer-options\}

```typescript showLineNumbers copy
// 基本設定
const basicLLMScorer = createLLMScorer({
  model: openai('gpt-4o-mini'),
  availableTools: [
    { name: 'tool1', description: '説明 1' },
    { name: 'tool2', description: '説明 2' }
  ]
});

// 別のモデルを使用する場合
const customModelScorer = createLLMScorer({
  model: openai('gpt-4'), // より高度な評価に適した高性能モデル
  availableTools: [...]
});
```

## 結果の理解について \{#understanding-the-results\}

### コードベースのスコアリング結果 \{#code-based-scorer-results\}

```typescript
{
  runId: string,
  preprocessStepResult: {
    expectedTool: string,
    actualTools: string[],
    strictMode: boolean,
    expectedToolOrder?: string[],
    hasToolCalls: boolean,
    correctToolCalled: boolean,
    correctOrderCalled: boolean | null,
    toolCallInfos: ToolCallInfo[]
  },
  score: number // 常に0または1
}
```

### LLMベース評価器の結果 \{#llm-based-scorer-results\}

```typescript
{
  runId: string,
  score: number,  // 0.0 ～ 1.0
  reason: string, // 人が読んで理解できる説明
  analyzeStepResult: {
    evaluations: Array<{
      toolCalled: string,
      wasAppropriate: boolean,
      reasoning: string
    }>,
    missingTools?: string[]
  }
}
```

## スコアラーの使い分けの目安 \{#when-to-use-each-scorer\}

### コードベースのスコアラーを使う用途: \{#use-code-based-scorer-for\}

* ユニットテスト
* CI/CD パイプライン
* 回帰テスト
* ツール要件との厳密な一致
* ツールの実行順序の検証

### LLMベースのスコアラーの用途: \{#use-llm-based-scorer-for\}

* 本番評価
* 品質保証
* ユーザー意図との整合
* 文脈を踏まえた評価
* エッジケースへの対応