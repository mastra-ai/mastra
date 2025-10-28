---
title: "Human in the Loop"
description: Mastraを用いて、人の介入ポイントを設けたレガシーなワークフローを構築する例。
---

# Human-in-the-Loop ワークフロー（レガシー） \{#human-in-the-loop-workflow-legacy\}

Human-in-the-Loop のワークフローでは、特定の段階で実行を一時停止し、ユーザー入力の収集、意思決定、あるいは人間の判断を要するアクションの実行を行えます。この例では、人による介入ポイントを備えたレガシーなワークフローの作成方法を示します。

## 仕組み \{#how-it-works\}

1. ワークフローのステップは `suspend()` 関数を使って実行を**一時停止**でき、必要に応じて人間の意思決定者向けのコンテキストを含むペイロードを渡せます。
2. ワークフローが**再開**されると、人間による入力は `resume()` 呼び出しの `context` パラメータで渡されます。
3. この入力はステップの実行コンテキストで `context.inputData` として利用可能になり、ステップの `inputSchema` に基づいて型付けされます。
4. その後、ステップは人間の入力に基づいて実行を継続できます。

このパターンにより、自動化ワークフローにおいて、安全で型チェックされた人間の介入が可能になります。

## Inquirer を使ったインタラクティブなターミナルの例 \{#interactive-terminal-example-using-inquirer\}

この例では、ワークフローが一時停止している間に、ターミナルから直接ユーザー入力を取得するために [Inquirer](https://www.npmjs.com/package/@inquirer/prompts) ライブラリを使う方法を示し、人間が介在するインタラクティブな体験（human-in-the-loop）を実現します。

```ts showLineNumbers copy
import { Mastra } from '@mastra/core';
import { LegacyStep, LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { z } from 'zod';
import { confirm, input, select } from '@inquirer/prompts';

// ステップ 1: 商品おすすめを生成する
const generateRecommendations = new LegacyStep({
  id: 'generateRecommendations',
  outputSchema: z.object({
    customerName: z.string(),
    recommendations: z.array(
      z.object({
        productId: z.string(),
        productName: z.string(),
        price: z.number(),
        description: z.string(),
      }),
    ),
  }),
  execute: async ({ context }) => {
    const customerName = context.triggerData.customerName;

    // In a real application, you might call an API or ML model here
    // For this example, we'll return mock data
    return {
      customerName,
      recommendations: [
        {
          productId: 'prod-001',
          productName: 'Premium Widget',
          price: 99.99,
          description: '高度な機能を備えた当社のベストセラー高級ウィジェット',
        },
        {
          productId: 'prod-002',
          productName: 'Basic Widget',
          price: 49.99,
          description: '初心者向けの手ごろなエントリーモデルのウィジェット',
        },
        {
          productId: 'prod-003',
          productName: 'Widget Pro Plus',
          price: 149.99,
          description: '延長保証付きのプロ向けウィジェット',
        },
      ],
    };
  },
});
```

```ts showLineNumbers copy
// ステップ 2: 推薦内容について人手による承認とカスタマイズを行う
const reviewRecommendations = new LegacyStep({
  id: 'reviewRecommendations',
  inputSchema: z.object({
    approvedProducts: z.array(z.string()),
    customerNote: z.string().optional(),
    offerDiscount: z.boolean().optional(),
  }),
  outputSchema: z.object({
    finalRecommendations: z.array(
      z.object({
        productId: z.string(),
        productName: z.string(),
        price: z.number(),
      }),
    ),
    customerNote: z.string().optional(),
    offerDiscount: z.boolean(),
  }),
  execute: async ({ context, suspend }) => {
    const { customerName, recommendations } = context.getStepResult(generateRecommendations) || {
      customerName: '',
      recommendations: [],
    };

    // Check if we have input from a resumed workflow
    const reviewInput = {
      approvedProducts: context.inputData?.approvedProducts || [],
      customerNote: context.inputData?.customerNote,
      offerDiscount: context.inputData?.offerDiscount,
    };

    // If we don't have agent input yet, suspend for human review
    if (!reviewInput.approvedProducts.length) {
      console.log(`Generating recommendations for customer: ${customerName}`);
      await suspend({
        customerName,
        recommendations,
        message: 'これらの製品の推薦内容を顧客に送信する前にご確認ください',
      });

      // プレースホルダーの返り値（suspend により到達しません）
      return {
        finalRecommendations: [],
        customerNote: '',
        offerDiscount: false,
      };
    }

    // エージェントによる製品選定を処理する
    const finalRecommendations = recommendations
      .filter(product => reviewInput.approvedProducts.includes(product.productId))
      .map(product => ({
        productId: product.productId,
        productName: product.productName,
        price: product.price,
      }));

    return {
      finalRecommendations,
      customerNote: reviewInput.customerNote || '',
      offerDiscount: reviewInput.offerDiscount || false,
    };
  },
});
```

```ts showLineNumbers copy
// ステップ3: 顧客におすすめ商品を送信する
const sendRecommendations = new LegacyStep({
  id: 'sendRecommendations',
  outputSchema: z.object({
    emailSent: z.boolean(),
    emailContent: z.string(),
  }),
  execute: async ({ context }) => {
    const { customerName } = context.getStepResult(generateRecommendations) || {
      customerName: '',
    };
    const { finalRecommendations, customerNote, offerDiscount } = context.getStepResult(reviewRecommendations) || {
      finalRecommendations: [],
      customerNote: '',
      offerDiscount: false,
    };

    // おすすめ商品に基づいてメール本文を生成する
    let emailContent = `${customerName}様\n\nお客様のご希望に基づき、以下の商品をおすすめいたします:\n\n`;

    finalRecommendations.forEach(product => {
      emailContent += `- ${product.productName}: $${product.price.toFixed(2)}\n`;
    });

    if (offerDiscount) {
      emailContent += '\n大切なお客様への特典として、次回のご購入時にコードSAVE10をご利用いただくと10%割引になります!\n';
    }

    if (customerNote) {
      emailContent += `\n担当者からのメッセージ: ${customerNote}\n`;
    }

    emailContent += '\n今後ともよろしくお願いいたします。\n営業チーム';

    // 実際のアプリケーションでは、このメールを送信します
    console.log('メール本文が生成されました:', emailContent);

    return {
      emailSent: true,
      emailContent,
    };
  },
});

// ワークフローを構築する
const recommendationWorkflow = new LegacyWorkflow({
  name: 'product-recommendation-workflow',
  triggerSchema: z.object({
    customerName: z.string(),
  }),
});

recommendationWorkflow.step(generateRecommendations).then(reviewRecommendations).then(sendRecommendations).commit();

// ワークフローを登録する
const mastra = new Mastra({
  legacy_workflows: { recommendationWorkflow },
});
```

```ts showLineNumbers copy
// Inquirerプロンプトを使用したワークフローの使用例
async function runRecommendationWorkflow() {
  const registeredWorkflow = mastra.legacy_getWorkflow('recommendationWorkflow');
  const run = registeredWorkflow.createRun();

  console.log('商品レコメンデーションワークフローを開始しています...');
  const result = await run.start({
    triggerData: {
      customerName: 'Jane Smith',
    },
  });

  const isReviewStepSuspended = result.activePaths.get('reviewRecommendations')?.status === 'suspended';

  // ワークフローが人によるレビューのために一時停止されているかを確認
  if (isReviewStepSuspended) {
    const { customerName, recommendations, message } = result.activePaths.get('reviewRecommendations')?.suspendPayload;

    console.log('\n===================================');
    console.log(message);
    console.log(`Customer: ${customerName}`);
    console.log('===================================\n');

    // Inquirerを使用して、ターミナルで営業担当者から入力を収集
    console.log('利用可能な商品レコメンデーション:');
    recommendations.forEach((product, index) => {
      console.log(`${index + 1}. ${product.productName} - $${product.price.toFixed(2)}`);
      console.log(`   ${product.description}\n`);
    });

    // 担当者に顧客へ推薦する商品を選択させる
    const approvedProducts = await checkbox({
      message: '顧客に推薦する商品を選択してください:',
      choices: recommendations.map(product => ({
        name: `${product.productName} ($${product.price.toFixed(2)})`,
        value: product.productId,
      })),
    });

    // 担当者にパーソナルメッセージを追加させる
    const includeNote = await confirm({
      message: 'パーソナルメッセージを追加しますか?',
      default: false,
    });

    let customerNote = '';
    if (includeNote) {
      customerNote = await input({
        message: '顧客へのパーソナルメッセージを入力してください:',
      });
    }

    // 割引を提供するかどうかを尋ねる
    const offerDiscount = await confirm({
      message: 'この顧客に10%割引を提供しますか?',
      default: false,
    });

    console.log('\nレビューを送信しています...');

    // 担当者の入力でワークフローを再開
    const resumeResult = await run.resume({
      stepId: 'reviewRecommendations',
      context: {
        approvedProducts,
        customerNote,
        offerDiscount,
      },
    });

    console.log('\n===================================');
    console.log('ワークフローが完了しました!');
    console.log('メール内容:');
    console.log('===================================\n');
    console.log(resumeResult?.results?.sendRecommendations || 'メール内容が生成されませんでした');

    return resumeResult;
  }

  return result;
}

// インタラクティブなターミナル入力でワークフローを呼び出す
runRecommendationWorkflow().catch(console.error);
```

## 複数のユーザー入力を伴う高度な例 \{#advanced-example-with-multiple-user-inputs\}

この例では、コンテンツモデレーションシステムのように、人間による介入が複数回必要となる、より複雑なワークフローを示します。

```ts showLineNumbers copy
import { Mastra } from '@mastra/core';
import { LegacyStep, LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { z } from 'zod';
import { select, input } from '@inquirer/prompts';

// ステップ1: コンテンツを受け取り、分析する
const analyzeContent = new LegacyStep({
  id: 'analyzeContent',
  outputSchema: z.object({
    content: z.string(),
    aiAnalysisScore: z.number(),
    flaggedCategories: z.array(z.string()).optional(),
  }),
  execute: async ({ context }) => {
    const content = context.triggerData.content;

    // Simulate AI analysis
    const aiAnalysisScore = simulateContentAnalysis(content);
    const flaggedCategories = aiAnalysisScore < 0.7 ? ['不適切の可能性あり', '要確認'] : [];

    return {
      content,
      aiAnalysisScore,
      flaggedCategories,
    };
  },
});
```

```ts showLineNumbers copy
// ステップ2: レビューが必要なコンテンツをモデレートする
const moderateContent = new LegacyStep({
  id: 'moderateContent',
  // 再開時に提供される人間の入力のスキーマを定義
  inputSchema: z.object({
    moderatorDecision: z.enum(['approve', 'reject', 'modify']).optional(),
    moderatorNotes: z.string().optional(),
    modifiedContent: z.string().optional(),
  }),
  outputSchema: z.object({
    moderationResult: z.enum(['approved', 'rejected', 'modified']),
    moderatedContent: z.string(),
    notes: z.string().optional(),
  }),
  // @ts-ignore
  execute: async ({ context, suspend }) => {
    const analysisResult = context.getStepResult(analyzeContent);
    // ワークフロー再開時に提供された入力にアクセス
    const moderatorInput = {
      decision: context.inputData?.moderatorDecision,
      notes: context.inputData?.moderatorNotes,
      modifiedContent: context.inputData?.modifiedContent,
    };

    // AI分析スコアが十分に高い場合は自動承認
    if (analysisResult?.aiAnalysisScore > 0.9 && !analysisResult?.flaggedCategories?.length) {
      return {
        moderationResult: 'approved',
        moderatedContent: analysisResult.content,
        notes: 'システムにより自動承認',
      };
    }

    // モデレーターの入力がまだない場合は、人間のレビューのため一時停止
    if (!moderatorInput.decision) {
      await suspend({
        content: analysisResult?.content,
        aiScore: analysisResult?.aiAnalysisScore,
        flaggedCategories: analysisResult?.flaggedCategories,
        message: 'このコンテンツをレビューしてモデレーション判定を行ってください',
      });

      // プレースホルダーの戻り値
      return {
        moderationResult: 'approved',
        moderatedContent: '',
      };
    }

    // モデレーターの判定を処理
    switch (moderatorInput.decision) {
      case 'approve':
        return {
          moderationResult: 'approved',
          moderatedContent: analysisResult?.content || '',
          notes: moderatorInput.notes || 'モデレーターにより承認',
        };

      case 'reject':
        return {
          moderationResult: 'rejected',
          moderatedContent: '',
          notes: moderatorInput.notes || 'モデレーターにより却下',
        };

      case 'modify':
        return {
          moderationResult: 'modified',
          moderatedContent: moderatorInput.modifiedContent || analysisResult?.content || '',
          notes: moderatorInput.notes || 'モデレーターにより修正',
        };

      default:
        return {
          moderationResult: 'rejected',
          moderatedContent: '',
          notes: '無効なモデレーター判定',
        };
    }
  },
});
```

```ts showLineNumbers copy
// ステップ 3: モデレーション処理を適用する
const applyModeration = new LegacyStep({
  id: 'applyModeration',
  outputSchema: z.object({
    finalStatus: z.string(),
    content: z.string().optional(),
    auditLog: z.object({
      originalContent: z.string(),
      moderationResult: z.string(),
      AIスコア: z.number(),
      timestamp: z.string(),
    }),
  }),
  execute: async ({ context }) => {
    const analysisResult = context.getStepResult(analyzeContent);
    const moderationResult = context.getStepResult(moderateContent);

    // 監査ログを作成
    const auditLog = {
      originalContent: analysisResult?.content || '',
      moderationResult: moderationResult?.moderationResult || 'unknown',
      aiScore: analysisResult?.aiAnalysisScore || 0,
      timestamp: new Date().toISOString(),
    };

    // モデレーション処理を適用
    switch (moderationResult?.moderationResult) {
      case 'approved':
        return {
          finalStatus: 'コンテンツを公開',
          content: moderationResult.moderatedContent,
          auditLog,
        };

      case 'modified':
        return {
          finalStatus: 'コンテンツを修正して公開',
          content: moderationResult.moderatedContent,
          auditLog,
        };

      case 'rejected':
        return {
          finalStatus: 'コンテンツを却下',
          auditLog,
        };

      default:
        return {
          finalStatus: 'モデレーション処理でエラーが発生',
          auditLog,
        };
    }
  },
});
```

```ts showLineNumbers copy
// ワークフローを構築
const contentModerationWorkflow = new LegacyWorkflow({
  name: 'content-moderation-workflow',
  triggerSchema: z.object({
    content: z.string(),
  }),
});

contentModerationWorkflow.step(analyzeContent).then(moderateContent).then(applyModeration).commit();

// ワークフローを登録
const mastra = new Mastra({
  legacy_workflows: { contentModerationWorkflow },
});

// Inquirerプロンプトを使用したワークフローの例
async function runModerationDemo() {
  const registeredWorkflow = mastra.legacy_getWorkflow('contentModerationWorkflow');
  const run = registeredWorkflow.createRun();

  // レビューが必要なコンテンツでワークフローを開始
  console.log('コンテンツモデレーションワークフローを開始中...');
  const result = await run.start({
    triggerData: {
      content: 'これはモデレーションが必要なユーザー生成コンテンツです。',
    },
  });

  const isReviewStepSuspended = result.activePaths.get('moderateContent')?.status === 'suspended';

  // ワークフローが一時停止されているか確認
  if (isReviewStepSuspended) {
    const { content, aiScore, flaggedCategories, message } = result.activePaths.get('moderateContent')?.suspendPayload;

    console.log('\n===================================');
    console.log(message);
    console.log('===================================\n');

    console.log('レビュー対象のコンテンツ:');
    console.log(content);
    console.log(`\nAI分析スコア: ${aiScore}`);
    console.log(`フラグ付きカテゴリ: ${flaggedCategories?.join('、') || 'なし'}\n`);

    // Inquirerを使用してモデレーターの判断を収集
    const moderatorDecision = await select({
      message: 'モデレーションの判断を選択してください:',
      choices: [
        { name: 'コンテンツをそのまま承認', value: 'approve' },
        { name: 'コンテンツを完全に拒否', value: 'reject' },
        { name: '公開前にコンテンツを修正', value: 'modify' },
      ],
    });

    // 判断に基づいて追加情報を収集
    let moderatorNotes = '';
    let modifiedContent = '';

    moderatorNotes = await input({
      message: '判断に関するメモを入力してください:',
    });

    if (moderatorDecision === 'modify') {
      modifiedContent = await input({
        message: '修正後のコンテンツを入力してください:',
        default: content,
      });
    }

    console.log('\nモデレーションの判断を送信中...');

    // モデレーターの入力でワークフローを再開
    const resumeResult = await run.resume({
      stepId: 'moderateContent',
      context: {
        moderatorDecision,
        moderatorNotes,
        modifiedContent,
      },
    });

    if (resumeResult?.results?.applyModeration?.status === 'success') {
      console.log('\n===================================');
      console.log(`モデレーション完了: ${resumeResult?.results?.applyModeration?.output.finalStatus}`);
      console.log('===================================\n');

      if (resumeResult?.results?.applyModeration?.output.content) {
        console.log('公開されたコンテンツ:');
        console.log(resumeResult.results.applyModeration.output.content);
      }
    }

    return resumeResult;
  }

  console.log('ワークフローは人の介入なしで完了しました:', result.results);
  return result;
}

// AIコンテンツ分析シミュレーション用のヘルパー関数
function simulateContentAnalysis(content: string): number {
  // 実際のアプリケーションでは、AIサービスを呼び出します
  // この例では、ランダムなスコアを返しています
  return Math.random();
}

// デモ関数を実行
runModerationDemo().catch(console.error);
```

## 重要な概念 \{#key-concepts\}

1. **サスペンドポイント** - ステップの `execute` 内で `suspend()` 関数を使い、ワークフローの実行を一時停止します。

2. **サスペンド時のペイロード** - サスペンド時に関連データを渡して、人間による意思決定のためのコンテキストを提供します。

```ts
await suspend({
  messageForHuman: 'このデータをご確認ください',
  data: someImportantData,
});
```

3. **ワークフローのステータス確認** - ワークフロー開始後、返されたステータスを確認し、一時停止中かどうかを確かめます：

```ts
const result = await workflow.start({ triggerData });
if (result.status === 'suspended' && result.suspendedStepId === 'stepId') {
  // 一時停止を処理
  console.log('ワークフローは入力待ちです:', result.suspendPayload);
}
```

4. **対話型のターミナル入力** - Inquirer などのライブラリを使って、対話的なプロンプトを作成します:

```ts
import { select, input, confirm } from '@inquirer/prompts';

// ワークフローが一時停止された場合
if (result.status === 'suspended') {
  // サスペンドペイロードの情報を表示
  console.log(result.suspendPayload.message);

  // 対話的にユーザーから入力を取得
  const decision = await select({
    message: 'どうしますか？',
    choices: [
      { name: '承認', value: 'approve' },
      { name: '却下', value: 'reject' },
    ],
  });

  // 取得した入力を基にワークフローを再開
  await run.resume({
    stepId: result.suspendedStepId,
    context: { decision },
  });
}
```

5. **ワークフローの再開** - 人の入力を受けてワークフローの実行を再開するには、`resume()` メソッドを使用します：

```ts
const resumeResult = await run.resume({
  stepId: 'suspendedStepId',
  context: {
    // このデータは一時停止されたステップに context.inputData として渡され
    // そのステップの inputSchema に適合している必要があります
    userDecision: 'approve',
  },
});
```

6. **人によるデータ入力のための入力スキーマ** - 人の入力で再開され得るステップに対して入力スキーマを定義し、型安全性を確保します。

```ts
const myStep = new LegacyStep({
  id: 'myStep',
  inputSchema: z.object({
    // このスキーマは、resume のコンテキストに渡されたデータを検証し、
    // context.inputData として利用できるようにします
    userDecision: z.enum(['approve', 'reject']),
    userComments: z.string().optional(),
  }),
  execute: async ({ context, suspend }) => {
    // 以前のサスペンド時のユーザー入力があるか確認します
    if (context.inputData?.userDecision) {
      // ユーザーの選択を処理します
      return { result: `User decided: ${context.inputData.userDecision}` };
    }

    // 入力がなければ、人による判断を待つためにサスペンドします
    await suspend();
  },
});
```

人間の判断を取り入れた自動化システムを構築するうえで、Human-in-the-loop ワークフローは非常に有効です。たとえば次のようなケースがあります：

* コンテンツモデレーションシステム
* 承認ワークフロー
* 人間の監督付き AI システム
* エスカレーションに対応したカスタマーサービスの自動化

<br />

<br />

<hr className={"dark:border-[#404040] border-gray-300"} />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/workflows-legacy/human-in-the-loop"
}
/>

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクは、レガシーワークフローの例を示すドキュメントです。

* [シンプルなワークフローの作成（レガシー）](/docs/examples/workflows_legacy/creating-a-workflow)
* [段階的な実行（シーケンシャル）のワークフロー（レガシー）](/docs/examples/workflows_legacy/sequential-steps)
* [ステップを用いた並列実行](/docs/examples/workflows_legacy/parallel-steps)
* [分岐パス](/docs/examples/workflows_legacy/branching-paths)
* [条件分岐付きワークフロー（レガシー・実験的）](/docs/examples/workflows_legacy/conditional-branching)
* [ワークフロー（レガシー）からのエージェント呼び出し](/docs/examples/workflows_legacy/calling-agent)
* [ツールをワークフローのステップとして使用（レガシー）](/docs/examples/workflows_legacy/using-a-tool-as-a-step)
* [循環依存を含むワークフロー（レガシー）](/docs/examples/workflows_legacy/cyclical-dependencies)
* [ワークフロー変数によるデータマッピング（レガシー）](/docs/examples/workflows_legacy/workflow-variables)
* [サスペンドとレジューム対応のワークフロー（レガシー）](/docs/examples/workflows_legacy/suspend-and-resume)