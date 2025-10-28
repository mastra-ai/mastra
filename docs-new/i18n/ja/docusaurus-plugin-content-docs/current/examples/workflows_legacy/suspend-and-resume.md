---
title: "一時停止と再開"
description: 実行中にレガシーなワークフローの手順を一時停止・再開するために Mastra を使用する例。
---

# ワークフロー（レガシー）の一時停止と再開 \{#workflow-legacy-with-suspend-and-resume\}

ワークフローの各ステップは、実行中の任意のタイミングで一時停止したり再開したりできます。以下の例では、ワークフローのステップを一時停止し、後で再開する方法を示します。

## 基本例 \{#basic-example\}

```ts showLineNumbers copy
import { Mastra } from '@mastra/core';
import { LegacyStep, LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

const stepOne = new LegacyStep({
  id: 'stepOne',
  outputSchema: z.object({
    doubledValue: z.number(),
  }),
  execute: async ({ context }) => {
    const doubledValue = context.triggerData.inputValue * 2;
    return { doubledValue };
  },
});
```

```ts showLineNumbers copy
const stepTwo = new LegacyStep({
  id: 'stepTwo',
  outputSchema: z.object({
    incrementedValue: z.number(),
  }),
  execute: async ({ context, suspend }) => {
    const secondValue = context.inputData?.secondValue ?? 0;
    const doubledValue = context.getStepResult(stepOne)?.doubledValue ?? 0;

    const incrementedValue = doubledValue + secondValue;

    if (incrementedValue < 100) {
      await suspend();
      return { incrementedValue: 0 };
    }
    return { incrementedValue };
  },
});

// ワークフローを構築
const myWorkflow = new LegacyWorkflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});

// ワークフローを並列で実行
myWorkflow.step(stepOne).then(stepTwo).commit();
```

```ts showLineNumbers copy
// ワークフローを登録
export const mastra = new Mastra({
  legacy_workflows: { registeredWorkflow: myWorkflow },
});

// Mastraから登録済みワークフローを取得
const registeredWorkflow = mastra.legacy_getWorkflow('registeredWorkflow');
const { runId, start } = registeredWorkflow.createRun();

// 実行前にワークフローの監視を開始
myWorkflow.watch(async ({ context, activePaths }) => {
  for (const _path of activePaths) {
    const stepTwoStatus = context.steps?.stepTwo?.status;
    if (stepTwoStatus === 'suspended') {
      console.log('ワークフローが中断されました。新しい値で再開します');

      // 新しいコンテキストでワークフローを再開
      await myWorkflow.resume({
        runId,
        stepId: 'stepTwo',
        context: { secondValue: 100 },
      });
    }
  }
});

// ワークフローの実行を開始
await start({ triggerData: { inputValue: 45 } });
```

## async/await パターンとサスペンド・ペイロードを用いた、複数のサスペンションポイントを持つ高度な例 \{#advanced-example-with-multiple-suspension-points-using-asyncawait-pattern-and-suspend-payloads\}

この例では、async/await パターンを用いて複数のサスペンションポイントを持つ、より複雑なワークフローを示します。さまざまな段階で人による介入が必要となるコンテンツ生成ワークフローをシミュレートします。

```ts showLineNumbers copy
import { Mastra } from '@mastra/core';
import { LegacyStep, LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

// ステップ1: ユーザー入力を取得
const getUserInput = new LegacyStep({
  id: 'getUserInput',
  execute: async ({ context }) => {
    // 実際のアプリケーションでは、フォームやAPIから取得されます
    return { userInput: context.triggerData.input };
  },
  outputSchema: z.object({ userInput: z.string() }),
});
```

```ts showLineNumbers copy
// ステップ2: AIでコンテンツを生成(人間のガイダンスが必要な場合は中断)
const promptAgent = new LegacyStep({
  id: 'promptAgent',
  inputSchema: z.object({
    guidance: z.string(),
  }),
  execute: async ({ context, suspend }) => {
    console.log(`次の内容に基づいてコンテンツを生成中: ${userInput}`);
    console.log(`Generating content based on: ${userInput}`);

    const guidance = context.inputData?.guidance;

    // AIによるコンテンツ生成をシミュレート
    const initialDraft = generateInitialDraft(userInput);

    // 信頼度が高い場合は、生成されたコンテンツをそのまま返す
    if (initialDraft.confidenceScore > 0.7) {
      return { modelOutput: initialDraft.content };
    }

    console.log('生成されたコンテンツの信頼度が低いため、人間のガイダンスを求めて中断します', { guidance });

    // 信頼度が低い場合は、人間のガイダンスを求めて中断
    if (!guidance) {
      // ガイダンスが提供されていない場合のみ中断
      await suspend();
      return undefined;
    }

    // このコードは人間のガイダンスによる再開後に実行されます
    console.log('人間のガイダンスにより再開しました');

    // 人間のガイダンスを使用して出力を改善
    return {
      modelOutput: enhanceWithGuidance(initialDraft.content, guidance),
    };
  },
  outputSchema: z.object({ modelOutput: z.string() }).optional(),
});
```

```ts showLineNumbers copy
// ステップ3: コンテンツ品質を評価
const evaluateTone = new LegacyStep({
  id: 'evaluateToneConsistency',
  execute: async ({ context }) => {
    const content = context.getStepResult(promptAgent)?.modelOutput;

    // 評価をシミュレート
    return {
      toneScore: { score: calculateToneScore(content) },
      completenessScore: { score: calculateCompletenessScore(content) },
    };
  },
  outputSchema: z.object({
    toneScore: z.any(),
    completenessScore: z.any(),
  }),
});
```

```ts showLineNumbers copy
// ステップ4: 必要に応じてレスポンスを改善(中断される可能性あり)
const improveResponse = new LegacyStep({
  id: 'improveResponse',
  inputSchema: z.object({
    improvedContent: z.string(),
    resumeAttempts: z.number(),
  }),
  execute: async ({ context, suspend }) => {
    const content = context.getStepResult(promptAgent)?.modelOutput;
    const toneScore = context.getStepResult(evaluateTone)?.toneScore.score ?? 0;
    const completenessScore = context.getStepResult(evaluateTone)?.completenessScore.score ?? 0;

    const improvedContent = context.inputData.improvedContent;
    const resumeAttempts = context.inputData.resumeAttempts ?? 0;

    // スコアが閾値を超えている場合、軽微な改善を実施
    if (toneScore > 0.8 && completenessScore > 0.8) {
      return { improvedOutput: makeMinorImprovements(content) };
    }

    console.log('コンテンツ品質が閾値を下回ったため、人間の介入のために中断します', {
      improvedContent,
      resumeAttempts,
    });

    if (!improvedContent) {
      // コンテンツと再開試行回数を含むペイロードで中断
      await suspend({
        content,
        scores: { tone: toneScore, completeness: completenessScore },
        needsImprovement: toneScore < 0.8 ? 'tone' : 'completeness',
        resumeAttempts: resumeAttempts + 1,
      });
      return { improvedOutput: content ?? '' };
    }

    console.log('人間による改善内容で再開されました', improvedContent);
    return { improvedOutput: improvedContent ?? content ?? '' };
  },
  outputSchema: z.object({ improvedOutput: z.string() }).optional(),
});
```

```ts showLineNumbers copy
// ステップ5: 最終評価
const evaluateImproved = new LegacyStep({
  id: 'evaluateImprovedResponse',
  execute: async ({ context }) => {
    const improvedContent = context.getStepResult(improveResponse)?.improvedOutput;

    // 最終評価をシミュレート
    return {
      toneScore: { score: calculateToneScore(improvedContent) },
      completenessScore: { score: calculateCompletenessScore(improvedContent) },
    };
  },
  outputSchema: z.object({
    toneScore: z.any(),
    completenessScore: z.any(),
  }),
});

// ワークフローを構築
const contentWorkflow = new LegacyWorkflow({
  name: 'content-generation-workflow',
  triggerSchema: z.object({ input: z.string() }),
});

contentWorkflow
  .step(getUserInput)
  .then(promptAgent)
  .then(evaluateTone)
  .then(improveResponse)
  .then(evaluateImproved)
  .commit();
```

```ts showLineNumbers copy
// ワークフローを登録
const mastra = new Mastra({
  legacy_workflows: { contentWorkflow },
});

// ヘルパー関数(シミュレーション)
function generateInitialDraft(input: string = '') {
  // AIによるコンテンツ生成をシミュレート
  return {
    content: `次の内容に基づいて生成されたコンテンツ: ${input}`,
    confidenceScore: 0.6, // 中断をトリガーするために低い信頼度スコアをシミュレート
  };
}

function enhanceWithGuidance(content: string = '', guidance: string = '') {
  return `${content} (ガイダンスで強化: ${guidance})`;
}

function makeMinorImprovements(content: string = '') {
  return `${content} (軽微な改善を適用)`;
}

function calculateToneScore(_: string = '') {
  return 0.7; // 中断をトリガーするスコアをシミュレート
}

function calculateCompletenessScore(_: string = '') {
  return 0.9;
}

// 使用例
async function runWorkflow() {
  const workflow = mastra.legacy_getWorkflow('contentWorkflow');
  const { runId, start } = workflow.createRun();

  let finalResult: any;

  // ワークフローを開始
  const initialResult = await start({
    triggerData: { input: '持続可能なエネルギーに関するコンテンツを作成' },
  });

  console.log('初期ワークフロー状態:', initialResult.results);

  const promptAgentStepResult = initialResult.activePaths.get('promptAgent');

  // promptAgentステップが中断されているか確認
  if (promptAgentStepResult?.status === 'suspended') {
    console.log('promptAgentステップでワークフローが中断されました');
    console.log('中断ペイロード:', promptAgentStepResult?.suspendPayload);

    // 人間のガイダンスで再開
    const resumeResult1 = await workflow.resume({
      runId,
      stepId: 'promptAgent',
      context: {
        guidance: '太陽光と風力エネルギー技術により焦点を当てる',
      },
    });

    console.log('ワークフローが再開され、次のステップに進みました');

    let improveResponseResumeAttempts = 0;
    let improveResponseStatus = resumeResult1?.activePaths.get('improveResponse')?.status;

    // improveResponseステップが中断されているか確認
    while (improveResponseStatus === 'suspended') {
      console.log('improveResponseステップでワークフローが中断されました');
      console.log('中断ペイロード:', resumeResult1?.activePaths.get('improveResponse')?.suspendPayload);

      const improvedContent =
        improveResponseResumeAttempts < 3
          ? undefined
          : '太陽光と風力技術に焦点を当てた持続可能なエネルギーに関する完全改訂版コンテンツ';

      // 人間による改善で再開
      finalResult = await workflow.resume({
        runId,
        stepId: 'improveResponse',
        context: {
          improvedContent,
          resumeAttempts: improveResponseResumeAttempts,
        },
      });

      improveResponseResumeAttempts =
        finalResult?.activePaths.get('improveResponse')?.suspendPayload?.resumeAttempts ?? 0;
      improveResponseStatus = finalResult?.activePaths.get('improveResponse')?.status;

      console.log('改善された応答結果:', finalResult?.results);
    }
  }
  return finalResult;
}

// ワークフローを実行
const result = await runWorkflow();
console.log('ワークフローが完了しました');
console.log('最終ワークフロー結果:', result);
```

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクは、レガシーワークフローのサンプルドキュメントです：

* [シンプルなワークフローの作成（レガシー）](/docs/examples/workflows_legacy/creating-a-workflow)
* [順次ステップのワークフロー（レガシー）](/docs/examples/workflows_legacy/sequential-steps)
* [ステップの並列実行（レガシー）](/docs/examples/workflows_legacy/parallel-steps)
* [分岐パス（レガシー）](/docs/examples/workflows_legacy/branching-paths)
* [条件分岐付きワークフロー（レガシー・実験的）](/docs/examples/workflows_legacy/conditional-branching)
* [ワークフローからエージェントを呼び出す（レガシー）](/docs/examples/workflows_legacy/calling-agent)
* [ツールをワークフローのステップとして使用（レガシー）](/docs/examples/workflows_legacy/using-a-tool-as-a-step)
* [循環依存のあるワークフロー（レガシー）](/docs/examples/workflows_legacy/cyclical-dependencies)
* [ワークフロー変数によるデータマッピング（レガシー）](/docs/examples/workflows_legacy/workflow-variables)
* [Human-in-the-Loop ワークフロー（レガシー）](/docs/examples/workflows_legacy/human-in-the-loop)