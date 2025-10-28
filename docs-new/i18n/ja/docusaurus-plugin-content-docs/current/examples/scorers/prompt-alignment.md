---
title: "プロンプト整合性"
description: ユーザープロンプトの意図や要件に対して、応答がどの程度一致しているかを評価するために、Prompt Alignment スコアラーを使用する例。
---

# プロンプト整合性スコアラー \{#prompt-alignment-scorer\}

`createPromptAlignmentScorerLLM` を使って、意図、要件、完全性、形式の観点から、ユーザーのプロンプトとの整合度を応答ごとにスコアリングします。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

> API の完全なドキュメントと構成オプションについては、[`createPromptAlignmentScorerLLM`](/docs/reference/scorers/prompt-alignment)を参照してください。

## 良好なアラインメントの例 \{#excellent-alignment-example\}

この例では、回答がユーザーのプロンプトに完全に応え、すべての要件を満たしています。

```typescript filename="src/example-excellent-prompt-alignment.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { createPromptAlignmentScorerLLM } from '@mastra/evals/scorers/llm';

const scorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o-mini'),
});

const inputMessages = [
  {
    role: 'user',
    content: '負の数のエラー処理を含む階乗計算のPython関数を書いてください',
  },
];

const outputMessage = {
  text: `def factorial(n):
    """数値の階乗を計算します。"""
    if n < 0:
        raise ValueError("負の数に対して階乗は定義されていません")
    if n == 0 or n == 1:
        return 1
    return n * factorial(n - 1)`,
};

const result = await scorer.run({
  input: inputMessages,
  output: outputMessage,
});

console.log(result);
```

### 優れた整合性のある出力 \{#excellent-alignment-output\}

この出力は、意図を的確に捉えて要件をすべて満たし、適切な形式で提示されているため、高い評価を得ます。

```typescript
{
  score: 0.95,
  reason: 'スコアが0.95である理由は、階乗関数を作成するという主要な目的に完全に対応し、Python実装、負の数に対するエラー処理、適切なドキュメントを含むすべての要件を満たしているためです。コード形式は適切で、実装は完全です。'
}
```

## 部分的整合の例 \{#partial-alignment-example\}

この例では、応答は核心の意図には対処しているものの、いくつかの要件を満たしていなかったり、形式に不備があります。

```typescript filename="src/example-partial-prompt-alignment.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { createPromptAlignmentScorerLLM } from '@mastra/evals/scorers/llm';

const scorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o-mini'),
});

const inputMessages = [
  {
    role: 'user',
    content: 'TypeScriptの利点を箇条書きで列挙してください',
  },
];

const outputMessage = {
  text: 'TypeScriptは静的型付け、優れたIDE対応、そしてコンパイル時のエラーチェックによる強化されたコード信頼性を提供します。',
};

const result = await scorer.run({
  input: inputMessages,
  output: outputMessage,
});

console.log(result);
```

### 部分的に整合した出力 \{#partial-alignment-output\}

内容は正確ですが、要求された形式（箇条書き）に従っていないため、出力のスコアは低くなります。

```typescript
{
  score: 0.75,
  reason: 'スコアが0.75なのは、回答がTypeScriptの利点を説明するという意図に応えており、正確な情報を提供しているものの、要求された箇条書き形式を使用していないため、適切性の評価が低くなっているためです。'
}
```

## 整合の不十分な例 \{#poor-alignment-example\}

この例では、応答がユーザーの具体的な要件に対応していません。

```typescript filename="src/example-poor-prompt-alignment.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { createPromptAlignmentScorerLLM } from '@mastra/evals/scorers/llm';

const scorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o-mini'),
});

const inputMessages = [
  {
    role: 'user',
    content: '初期化、バリデーション、エラーハンドリング、ドキュメントを含むPythonクラスを書いてください',
  },
];

const outputMessage = {
  text: `class Example:
    def __init__(self, value):
        self.value = value`,
};

const result = await scorer.run({
  input: inputMessages,
  output: outputMessage,
});

console.log(result);
```

### アラインメントが不十分な出力 \{#poor-alignment-output\}

この出力は、検証、エラー処理、ドキュメントが不足しており、要件を一部しか満たしていないため、低評価となります。

```typescript
{
  score: 0.35,
  reason: 'スコアが0.35なのは、初期化を含むPythonクラスの作成という基本的な要件には対応しているものの、明示的に求められていた検証、エラー処理、ドキュメントが含まれておらず、要件を完全には満たしていないためです。'
}
```

## スコアラーの設定 \{#scorer-configuration\}

スコアリングの要件に合わせて、scale パラメーターや評価モードを調整することで、Prompt Alignment Scorer をカスタマイズできます。

```typescript showLineNumbers copy
const scorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o-mini'),
  options: {
    scale: 10, // 0-1ではなく0-10でスコア付け
    evaluationMode: 'both', // 'user'、'system'、または'both'(デフォルト)
  },
});
```

### 評価モードのサンプル \{#evaluation-mode-examples\}

#### ユーザーモード - ユーザーのプロンプトのみに集中 \{#user-mode-focus-on-user-prompt-only\}

システムの指示は考慮せず、応答がユーザーのリクエストにどれだけ適切に応えているかを評価します：

```typescript filename="src/example-user-mode.ts" showLineNumbers copy
const scorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o-mini'),
  options: { evaluationMode: 'user' },
});

const result = await scorer.run({
  input: {
    inputMessages: [
      {
        role: 'user',
        content: '再帰を例を使って説明してください',
      },
    ],
    systemMessages: [
      {
        role: 'system',
        content: 'コード例は常にPythonで提示してください',
      },
    ],
  },
  output: {
    text: '再帰とは、関数が自分自身を呼び出すことです。例えば、factorial(5) = 5 × factorial(4) のようになります',
  },
});
// Pythonのコードがなくても、ユーザーのリクエストへの対応として高評価
```

#### システムモード - システムガイドラインのみに注力 \{#system-mode-focus-on-system-guidelines-only\}

システムの行動ガイドラインおよび制約への順守状況を評価します：

```typescript filename="src/example-system-mode.ts" showLineNumbers copy
const scorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o-mini'),
  options: { evaluationMode: 'system' },
});

const result = await scorer.run({
  input: {
    systemMessages: [
      {
        role: 'system',
        content: 'あなたは有能なアシスタントです。常に丁寧で簡潔に、適切な例を示してください。',
      },
    ],
    inputMessages: [
      {
        role: 'user',
        content: '機械学習とは何ですか？',
      },
    ],
  },
  output: {
    text: '機械学習は、コンピュータがデータから学習するAIの一分野です。例えば、スパムフィルターは、過去にスパムと判定されたメールのパターンを分析し、不要なメールを見分ける方法を学習します。',
  },
});
// 丁寧さ、簡潔さ、例の提示を評価します
```

#### 両方モード - 統合評価（デフォルト） \{#both-mode-combined-evaluation-default\}

ユーザー意図の達成度とシステム準拠の両方を、重み付けスコア（ユーザー70%、システム30%）で評価します：

```typescript filename="src/example-both-mode.ts" showLineNumbers copy
const scorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o-mini'),
  options: { evaluationMode: 'both' }, // これがデフォルトです
});

const result = await scorer.run({
  input: {
    systemMessages: [
      {
        role: 'system',
        content: 'プログラミングの概念を説明する際は、常にコード例を提示してください',
      },
    ],
    inputMessages: [
      {
        role: 'user',
        content: '文字列を反転する方法を説明してください',
      },
    ],
  },
  output: {
    text: `文字列を反転するには、後ろから走査します。以下は Python の例です:
    
    def reverse_string(s):
        return s[::-1]
    
    # 使用例: reverse_string("hello") は "olleh" を返します`,
  },
});
// ユーザーの要求に応えると同時に、システムのガイドラインにも従っているため高評価
```

> 設定オプションの一覧については、[createPromptAlignmentScorerLLM](/docs/reference/scorers/prompt-alignment) を参照してください。

## 結果の理解 \{#understanding-the-results\}

`.run()` は次の形の結果を返します：

```typescript
{
  runId: string,
  score: number,
  reason: string,
  analyzeStepResult: {
    intentAlignment: {
      score: number,
      primaryIntent: string,
      isAddressed: boolean,
      reasoning: string
    },
    requirementsFulfillment: {
      requirements: Array<{
        requirement: string,
        isFulfilled: boolean,
        reasoning: string
      }>,
      overallScore: number
    },
    completeness: {
      score: number,
      missingElements: string[],
      reasoning: string
    },
    responseAppropriateness: {
      score: number,
      formatAlignment: boolean,
      toneAlignment: boolean,
      reasoning: string
    },
    overallAssessment: string
  }
}
```

### score \{#score\}

0 から scale（既定は 0～1）までの多次元アライメント・スコア:

* **0.9～1.0**: すべての側面で極めて高い整合
* **0.8～0.9**: わずかな抜けはあるが非常に高い整合
* **0.7～0.8**: 良好だが一部の要件を満たしていない
* **0.6～0.7**: 明確な抜けが見られる中程度の整合
* **0.4～0.6**: 重大な問題を伴う低い整合
* **0.0～0.4**: 極めて低い整合で、応答がプロンプトに十分に対応していない

### 評価の観点 \{#scoring-dimensions\}

スコアラーは、評価モードに応じて重み付けが変化する4つの観点を評価します:

**ユーザーモードの重み:**

* **意図整合性 (40%)**: 応答がユーザーの核心的な要望に対応しているか
* **要件充足 (30%)**: ユーザーの要件をすべて満たしているか
* **網羅性 (20%)**: 応答がユーザーのニーズに対して十分に包括的か
* **適切性 (10%)**: 形式とトーンがユーザーの期待に合っているか

**システムモードの重み:**

* **意図整合性 (35%)**: 応答がシステムの行動ガイドラインに従っているか
* **要件充足 (35%)**: システム上の制約をすべて守っているか
* **網羅性 (15%)**: 応答がシステムのルールをすべて満たしているか
* **適切性 (15%)**: 形式とトーンがシステム仕様に合っているか

**両方のモード（デフォルト）:**

* ユーザー整合（70%）とシステム遵守（30%）を組み合わせます
* ユーザー満足とシステム準拠の両面をバランスよく評価します

### runId \{#runid\}

このスコアラーの実行を一意に識別する ID です。

### 理由 \{#reason\}

各ディメンションの内訳や特定された問題点を含む、スコアの詳細な説明。

### analyzeStepResult \{#analyzestepresult\}

各指標のスコアとその理由を示す詳細な分析結果。

<GithubLink marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/scorers/prompt-alignment" />