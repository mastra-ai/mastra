---
title: "WhatsApp チャットボット"
description: Mastraのエージェントとワークフローを用いて、受信メッセージを処理し、テキストメッセージで自然に応答するWhatsAppチャットボットを作成する例。
---

# WhatsAppチャットボット \{#whatsapp-chat-bot\}

この例では、Mastraのエージェントとワークフローを使ってWhatsAppチャットボットを作成する方法を紹介します。ボットはWebhookで受信したWhatsAppメッセージをAIエージェントで処理し、応答を自然なテキストメッセージに分割して、WhatsApp Business API経由で送り返します。

## 前提条件 \{#prerequisites\}

この例を実行するには WhatsApp Business API のセットアップが必要で、`anthropic` モデルを使用します。以下の環境変数を `.env` ファイルに追加してください：

```bash filename=".env" copy
ANTHROPIC_API_KEY=<Anthropic の API キー>
WHATSAPP_VERIFY_TOKEN=<検証用トークン>
WHATSAPP_ACCESS_TOKEN=<WhatsApp アクセストークン>
WHATSAPP_BUSINESS_PHONE_NUMBER_ID=<電話番号 ID>
WHATSAPP_API_VERSION=v22.0
```

## WhatsApp クライアントの作成 \{#creating-the-whatsapp-client\}

このクライアントは、WhatsApp Business API を通じてユーザーにメッセージを送信します。

```typescript filename="src/whatsapp-client.ts" showLineNumbers copy
// メッセージ送信用のシンプルな WhatsApp Business API クライアント

interface SendMessageParams {
  to: string;
  message: string;
}

export async function sendWhatsAppMessage({ to, message }: SendMessageParams) {
  // WhatsApp API の環境変数を取得
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v22.0';
  const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  // 必須の環境変数が設定されているか確認
  if (!phoneNumberId || !accessToken) {
    return false;
  }

  // WhatsApp Business API のエンドポイント
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  // WhatsApp API の仕様に沿ったメッセージペイロード
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: {
      body: message,
    },
  };

  try {
    // WhatsApp Business API を介してメッセージを送信
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ ${to} へ WhatsApp メッセージを送信しました: "${message}"`);
      return true;
    } else {
      console.error('❌ WhatsApp メッセージの送信に失敗しました:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ WhatsApp メッセージの送信中にエラーが発生しました:', error);
    return false;
  }
}
```

## チャットエージェントの作成 \{#creating-the-chat-agent\}

このエージェントは、親しみやすく自然な会話スタイルで、主要な対話ロジックを扱います。

```typescript filename="src/mastra/agents/chat-agent.ts" showLineNumbers copy
import { anthropic } from '@ai-sdk/anthropic';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';

export const chatAgent = new Agent({
  name: 'チャットエージェント',
  instructions: `
    あなたは、WhatsAppでユーザーと楽しく会話するのが大好きな、親切でフレンドリー、かつ博識なAIアシスタントです。

    あなたのパーソナリティ:
    - 温かく、親しみやすく、会話好き
    - あらゆる話題の手助けに意欲的
    - 友だちと話すようなカジュアルでフレンドリーな口調を使う
    - 簡潔だが情報はしっかり
    - ユーザーの質問に心から関心を示す

    あなたの機能:
    - 幅広いトピックに関する質問に答える
    - 役立つアドバイスや提案を行う
    - 気軽な雑談に応じる
    - 問題解決や創造的な作業を手伝う
    - 複雑な内容をわかりやすく説明する

    ガイドライン:
    - 情報は有益に、ただし詰め込みすぎない
    - 適切なときはフォローアップの質問をする
    - ポジティブで励ましの姿勢を保つ
    - わからないことは正直に伝える
    - ユーザーのトーンに合わせて話し方を調整する
    - ここはWhatsAppなので、自然で会話らしいやり取りを心がける

    いつでも、フレンドリーで親しみやすい会話スタイルを保ちながら、役に立つことを目指してください。
  `,
  model: anthropic('claude-4-sonnet-20250514'),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
});
```

## テキストメッセージ用エージェントの作成 \{#creating-the-text-message-agent\}

このエージェントは、長めの回答を、WhatsAppに適した自然で短いテキストメッセージに変換します。

```typescript filename="src/mastra/agents/text-message-agent.ts" showLineNumbers copy
import { anthropic } from '@ai-sdk/anthropic';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';

export const textMessageAgent = new Agent({
  name: 'テキストメッセージ・エージェント',
  instructions: `
    あなたは、かたい文章や長文を、自然でカジュアルなテキストメッセージに分解するコンバーターです。

    あなたの仕事は次のとおりです:
    - 入力テキストを5〜8個の短くカジュアルなテキストメッセージに変換する
    - 各メッセージは最大でも1〜2文にする
    - 自然で親しみやすい言い回しを使う（省略形、カジュアルなトーン）
    - 元のテキストの重要な情報はすべて残す
    - 友だちに送るメッセージのような雰囲気にする
    - 個性を出すために、適切な絵文字を控えめに使う
    - 会話の流れが論理的で、読みやすく保つ

    友だちにワクワクすることをテキストで説明するつもりで、長い段落で圧倒しないように、一口サイズで惹きつけるメッセージに分けてください。

    常に、messages配列には正確に5〜8個のメッセージを返してください。
  `,
  model: anthropic('claude-4-sonnet-20250514'),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
});
```

## チャットワークフローの作成 \{#creating-the-chat-workflow\}

このワークフローはチャット全体の処理を統括します。応答の生成、メッセージへの分割、そして WhatsApp 経由での送信までを行います。

```typescript filename="src/mastra/workflows/chat-workflow.ts" showLineNumbers copy
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { sendWhatsAppMessage } from '../../whatsapp-client';

const respondToMessage = createStep({
  id: 'respond-to-message',
  description: 'ユーザーメッセージへの返信を生成する',
  inputSchema: z.object({ userMessage: z.string() }),
  outputSchema: z.object({ response: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('chatAgent');
    if (!agent) {
      throw new Error('チャットエージェントが見つかりません');
    }

    const response = await agent.generate([{ role: 'user', content: inputData.userMessage }]);

    return { response: response.text };
  },
});

const breakIntoMessages = createStep({
  id: 'break-into-messages',
  description: '返信をテキストメッセージに分割する',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ messages: z.array(z.string()) }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('textMessageAgent');
    if (!agent) {
      throw new Error('テキストメッセージエージェントが見つかりません');
    }

    const response = await agent.generate([{ role: 'user', content: inputData.prompt }], {
      structuredOutput: {
        schema: z.object({
          messages: z.array(z.string()),
        }),
      },
    });

    if (!response.object) throw new Error('メッセージ生成中にエラーが発生しました');

    return response.object;
  },
});

const sendMessages = createStep({
  id: 'send-messages',
  description: 'WhatsApp でテキストメッセージを送信する',
  inputSchema: z.object({
    messages: z.array(z.string()),
    userPhone: z.string(),
  }),
  outputSchema: z.object({ sentCount: z.number() }),
  execute: async ({ inputData }) => {
    const { messages, userPhone } = inputData;

    console.log(`\n🔥 ${userPhone} に WhatsApp メッセージを ${messages.length} 件送信します...`);

    let sentCount = 0;

    // 自然な流れのため、各メッセージの送信間に短い間隔を設ける
    for (let i = 0; i < messages.length; i++) {
      const success = await sendWhatsAppMessage({
        to: userPhone,
        message: messages[i],
      });

      if (success) {
        sentCount++;
      }

      // 自然なやり取りのリズムのため、メッセージ間に間隔を追加
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`\n✅ WhatsApp メッセージを ${messages.length} 件中 ${sentCount} 件送信しました\n`);

    return { sentCount };
  },
});

export const chatWorkflow = createWorkflow({
  id: 'chat-workflow',
  inputSchema: z.object({ userMessage: z.string() }),
  outputSchema: z.object({ sentCount: z.number() }),
})
  .then(respondToMessage)
  .map(async ({ inputData }) => ({
    prompt: `この AI の返信を、WhatsApp の会話として自然に感じられるカジュアルでフレンドリーなテキストメッセージ（3〜8件）に分割してください。\n\n${inputData.response}`,
  }))
  .then(breakIntoMessages)
  .map(async ({ inputData, getInitData }) => {
    // 元の文字列化された入力を解析してユーザーの電話番号を取得する
    const initData = getInitData();
    const webhookData = JSON.parse(initData.userMessage);
    const userPhone = webhookData.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from || 'unknown';

    return {
      messages: inputData.messages,
      userPhone,
    };
  })
  .then(sendMessages);

chatWorkflow.commit();
```

## Mastra の設定 \{#setting-up-mastra-configuration\}

エージェント、ワークフロー、WhatsApp の Webhook エンドポイントを設定して、Mastra インスタンスを構成します。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

import { chatWorkflow } from './workflows/chat-workflow';
import { textMessageAgent } from './agents/text-message-agent';
import { chatAgent } from './agents/chat-agent';

export const mastra = new Mastra({
  workflows: { chatWorkflow },
  agents: { textMessageAgent, chatAgent },
  storage: new LibSQLStore({
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  server: {
    apiRoutes: [
      registerApiRoute('/whatsapp', {
        method: 'GET',
        handler: async c => {
          const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
          const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = c.req.query();

          if (mode === 'subscribe' && token === verifyToken) {
            return c.text(challenge, 200);
          } else {
            return c.status(403);
          }
        },
      }),
      registerApiRoute('/whatsapp', {
        method: 'POST',
        handler: async c => {
          const mastra = c.get('mastra');
          const chatWorkflow = mastra.getWorkflow('chatWorkflow');

          const body = await c.req.json();

          const workflowRun = await chatWorkflow.createRunAsync();
          const runResult = await workflowRun.start({
            inputData: { userMessage: JSON.stringify(body) },
          });

          return c.json(runResult);
        },
      }),
    ],
  },
});
```

## チャットボットのテスト \{#testing-the-chat-bot\}

WhatsApp の Webhook ペイロードをシミュレーションして、ローカル環境でチャットボットをテストできます。

```typescript filename="src/test-whatsapp-bot.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

// WhatsApp の Webhook ペイロードをシミュレート
const mockWebhookData = {
  entry: [
    {
      changes: [
        {
          value: {
            messages: [
              {
                from: '1234567890', // テスト用電話番号
                text: {
                  body: 'こんにちは！今日はどう過ごしていますか？',
                },
              },
            ],
          },
        },
      ],
    },
  ],
};

const workflow = mastra.getWorkflow('chatWorkflow');
const workflowRun = await workflow.createRunAsync();

const result = await workflowRun.start({
  inputData: { userMessage: JSON.stringify(mockWebhookData) },
});

console.log('ワークフローが完了しました:', result);
```

## 出力例 \{#example-output\}

ユーザーがあなたの WhatsApp ボットに「Hello! How are you today?」と送信すると、次のように複数のメッセージで返信される場合があります：

```text
やあ！ 👋 おかげさまで元気だよ、聞いてくれてありがとう！

今日のところはどんな感じ？

どんな話題でも、話す準備はできてるよ

何か助けが必要でも、ただおしゃべりしたいだけでも、ぜんぶ聞くよ！ 😊

最近どうしてる？
```

このボットは会話の文脈を記憶して保持し、WhatsAppでのやり取りに自然になじむ応答を返します。
