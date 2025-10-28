---
title: "マルチターンの Human-in-the-Loop"
description: suspend/resume と doUntil メソッドを使って、マルチターンの人間／エージェントの対話ポイントを含むワークフローを Mastra で作成する例。
---

# 複数ターンのHuman-in-the-Loop \{#multi-turn-human-in-the-loop\}

複数ターンのHuman-in-the-Loopワークフローは、人間とAIエージェントの継続的なやり取りを可能にし、複数回の入力と応答を伴う複雑な意思決定プロセスを実現します。これらのワークフローは特定の時点で実行を一時停止し、人間からの入力を待ち、受け取った応答に基づいて処理を再開できます。

この例では、複数ターンのワークフローを用いてHeads Upゲームを作成し、サスペンド/リジューム機能と`dountil`による条件分岐ロジックを使って、特定の条件が満たされるまでワークフローステップを繰り返すインタラクティブなワークフローの作り方を示します。

この例は主に次の3つのコンポーネントで構成されています:

1. 有名人の名前を生成する[**Famous Person Agent**](#famous-person-agent)
2. ゲーム進行を担当する[**Game Agent**](#game-agent)
3. 対話を統括する[**Multi-Turn Workflow**](#multi-turn-workflow)

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用します。`.env` ファイルに次の内容を追加してください:

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

## 有名人エージェント \{#famous-person-agent\}

`famousPersonAgent` は、ゲームをプレイするたびに重ならない名前を生成し、セマンティックメモリを使って提案の重複を防ぎます。

```typescript filename="src/mastra/agents/example-famous-person-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLVector } from '@mastra/libsql';

export const famousPersonAgent = new Agent({
  name: '有名人ジェネレーター',
  instructions: `あなたは「Heads Up」という推理ゲーム用の有名人ジェネレーターです。

以下の条件を満たす、よく知られた有名人の名前を生成してください:
- 多くの人が認識できる
- はい/いいえで答えられる質問で特徴を説明できるほど特徴がはっきりしている
- あらゆる年齢層に適している
- 名前が明確で曖昧さがない

重要: これまでに提案した有名人を記憶で確認し、同じ人物を絶対に繰り返さないでください。

例: Albert Einstein, Beyoncé, Leonardo da Vinci, Oprah Winfrey, Michael Jordan

人名のみを返し、それ以外は何も返さないでください。`,
  model: openai('gpt-4o'),
  memory: new Memory({
    vector: new LibSQLVector({
      connectionUrl: 'file:../mastra.db',
    }),
    embedder: openai.embedding('text-embedding-3-small'),
    options: {
      lastMessages: 5,
      semanticRecall: {
        topK: 10,
        messageRange: 1,
      },
    },
  }),
});
```

> 設定オプションの一覧については、[Agent](/docs/reference/agents/agent) を参照してください。

## ゲームエージェント \{#game-agent\}

`gameAgent` は、質問への回答や推測の検証を通じて、ユーザーとのインタラクションを処理します。

```typescript filename="src/mastra/agents/example-game-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const gameAgent = new Agent({
  name: 'ゲームエージェント',
  instructions: `あなたは「ヘッズアップ」推測ゲームの親切なアシスタントです。

重要:あなたは有名人の名前を知っていますが、どんな応答でも絶対に明かしてはいけません。

ユーザーが有名人について質問してきた場合:
- 提供された有名人の情報に基づいて正直に答える
- 簡潔でフレンドリーな応答を心がける
- たとえ自然な流れでも、その人の名前は絶対に言わない
- 性別、国籍、その他の特徴について具体的に尋ねられない限り、明かさない
- はい/いいえの質問には明確に「はい」または「いいえ」で答える
- 一貫性を保つ - 同じ質問を違う言い方で聞かれても同じ答えを返す
- 質問が不明確な場合は明確化を求める
- 複数の質問を一度にされた場合は、一つずつ質問するよう依頼する

推測してきた場合:
- 正解の場合:温かく祝福する
- 不正解の場合:丁寧に訂正し、もう一度挑戦するよう励ます

プレイヤーが十分な情報を得たと思われる場合は、推測を促してください。

次の内容を含むJSONオブジェクトを返す必要があります:
- response: ユーザーへの応答
- gameWon: 正しく推測した場合はtrue、そうでない場合はfalse`,
  model: openai('gpt-4o'),
});
```

## 複数ターンのワークフロー \{#multi-turn-workflow\}

このワークフローは、`suspend`/`resume` による入力待ちでの一時停止と、`dountil` による条件達成までのゲームループの反復を用いて、全体のやり取りを制御します。

`startStep` は `famousPersonAgent` を使って名前を生成し、`gameStep` は `gameAgent` を通じてやり取りを実行します。`gameAgent` は質問と推測の両方を処理し、`gameWon` というブール値を含む構造化出力を生成します。

```typescript filename="src/mastra/workflows/example-heads-up-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const startStep = createStep({
  id: 'start-step',
  description: '有名人の名前を取得する',
  inputSchema: z.object({
    start: z.boolean(),
  }),
  outputSchema: z.object({
    famousPerson: z.string(),
    guessCount: z.number(),
  }),
  execute: async ({ mastra }) => {
    const agent = mastra.getAgent('famousPersonAgent');
    const response = await agent.generate("有名人の名前を生成してください", {
      temperature: 1.2,
      topP: 0.9,
      memory: {
        resource: 'heads-up-game',
        thread: 'famous-person-generator',
      },
    });
    const famousPerson = response.text.trim();
    return { famousPerson, guessCount: 0 };
  },
});

const gameStep = createStep({
  id: 'game-step',
  description: '質問→回答→継続のループを処理する',
  inputSchema: z.object({
    famousPerson: z.string(),
    guessCount: z.number(),
  }),
  resumeSchema: z.object({
    userMessage: z.string(),
  }),
  suspendSchema: z.object({
    suspendResponse: z.string(),
  }),
  outputSchema: z.object({
    famousPerson: z.string(),
    gameWon: z.boolean(),
    agentResponse: z.string(),
    guessCount: z.number(),
  }),
  execute: async ({ inputData, mastra, resumeData, suspend }) => {
    let { famousPerson, guessCount } = inputData;
    const { userMessage } = resumeData ?? {};

    if (!userMessage) {
      return await suspend({
        suspendResponse: "ある有名人を思い浮かべています。はい/いいえで答えられる質問をして、誰か当ててください！",
      });
    }

    const agent = mastra.getAgent('gameAgent');
    const response = await agent.generate(
      `
        The famous person is: ${famousPerson}
        The user said: "${userMessage}"
        Please respond appropriately. If this is a guess, tell me if it's correct.
      `,
      {
        structuredOutput: {
          schema: z.object({
            response: z.string(),
            gameWon: z.boolean(),
          }),
        },
        maxSteps: 1,
      },
    );

    const { response: agentResponse, gameWon } = response.object;

    guessCount++;

    return { famousPerson, gameWon, agentResponse, guessCount };
  },
});

const winStep = createStep({
  id: 'win-step',
  description: 'ゲーム勝利時の処理を行う',
  inputSchema: z.object({
    famousPerson: z.string(),
    gameWon: z.boolean(),
    agentResponse: z.string(),
    guessCount: z.number(),
  }),
  outputSchema: z.object({
    famousPerson: z.string(),
    gameWon: z.boolean(),
    guessCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { famousPerson, gameWon, guessCount } = inputData;

    console.log('famousPerson: ', famousPerson);
    console.log('gameWon: ', gameWon);
    console.log('guessCount: ', guessCount);

    return { famousPerson, gameWon, guessCount };
  },
});

export const headsUpWorkflow = createWorkflow({
  id: 'heads-up-workflow',
  inputSchema: z.object({
    start: z.boolean(),
  }),
  outputSchema: z.object({
    famousPerson: z.string(),
    gameWon: z.boolean(),
    guessCount: z.number(),
  }),
})
  .then(startStep)
  .dountil(gameStep, async ({ inputData: { gameWon } }) => gameWon)
  .then(winStep)
  .commit();
```

> 設定オプションの全一覧については、[Workflow](/docs/reference/workflows/workflow) を参照してください。

## エージェントとワークフローの登録 \{#registering-the-agents-and-workflow\}

ワークフローやエージェントを使用するには、メインの Mastra インスタンスに登録する必要があります。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';

import { headsUpWorkflow } from './workflows/example-heads-up-workflow';
import { famousPersonAgent } from './agents/example-famous-person-agent';
import { gameAgent } from './agents/example-game-agent';

export const mastra = new Mastra({
  workflows: { headsUpWorkflow },
  agents: { famousPersonAgent, gameAgent },
});
```

<GithubLink marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/heads-up-game/" />

## 関連項目 \{#related\}

* [ワークフローの実行](./running-workflows)
* [制御フロー](/docs/workflows/control-flow)