---
title: 発話の順番
description: Mastra を使って、発話の順番を伴う会話フローでマルチエージェントのディベートを作成する例。
---

# ターン制のAIディベート \{#ai-debate-with-turn-taking\}

以下のコードスニペットは、Mastra を用いてターン制のマルチエージェント会話システムを実装する方法を示します。この例では、ユーザーが指定したトピックについて、楽観主義者と懐疑主義者の2体のAIエージェントが互いの主張に交互に応答しながら議論します。

## 音声機能を備えたエージェントの作成 \{#creating-agents-with-voice-capabilities\}

まず、個性と音声機能の異なる2体のエージェントを作成します。

```typescript filename="src/mastra/agents/index.ts"
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { OpenAIVoice } from '@mastra/voice-openai';

export const optimistAgent = new Agent({
  name: '楽観主義者',
  instructions:
    'あなたはあらゆるトピックのポジティブな面を見出す楽観的なディベーターです。回答は簡潔で魅力的に、2〜3文程度でまとめてください。',
  model: openai('gpt-4o'),
  voice: new OpenAIVoice({
    speaker: 'alloy',
  }),
});

export const skepticAgent = new Agent({
  name: '懐疑論者',
  instructions:
    'あなたは前提に疑問を投げかけ、潜在的な問題点を指摘する無礼な懐疑的ディベーターです。回答は簡潔で魅力的に、2〜3文程度でまとめてください。',
  model: openai('gpt-4o'),
  voice: new OpenAIVoice({
    speaker: 'echo',
  }),
});
```

## Mastra へのエージェントの登録 \{#registering-the-agents-with-mastra\}

次に、両方のエージェントをMastraインスタンスに登録します。

```typescript filename="src/mastra/index.ts"
import { PinoLogger } from '@mastra/loggers';
import { Mastra } from '@mastra/core/mastra';
import { optimistAgent, skepticAgent } from './agents';

export const mastra = new Mastra({
  agents: {
    optimistAgent,
    skepticAgent,
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
```

## ディベートにおける発言順の管理 \{#managing-turn-taking-in-the-debate\}

この例では、エージェント間の発話順序の流れを管理し、各エージェントが直前のエージェントの発言に応答するようにする方法を示します:

```typescript filename="src/debate/turn-taking.ts"
import { mastra } from '../../mastra';
import { playAudio, Recorder } from '@mastra/node-audio';
import * as p from '@clack/prompts';

// テキストを行幅で折り返して整形するヘルパー関数
function formatText(text: string, maxWidth: number): string {
  const words = text.split(' ');
  let result = '';
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      result += (result ? '\n' : '') + currentLine;
      currentLine = word;
    }
  }

  if (currentLine) {
    result += (result ? '\n' : '') + currentLine;
  }

  return result;
}

// 音声レコーダーを初期化
const recorder = new Recorder({
  outputPath: './debate.mp3',
});

// 会話の1ターンを処理
async function processTurn(
  agentName: 'optimistAgent' | 'skepticAgent',
  otherAgentName: string,
  topic: string,
  previousResponse: string = '',
) {
  const agent = mastra.getAgent(agentName);
  const spinner = p.spinner();
`${agent.name} が思考中…`

  let prompt;
  if (!previousResponse) {
// 最初のターン
`このトピックについて議論してください: ${topic}。あなたの立場を述べてください。`
  } else {
// 相手エージェントへの応答
`トピックは次のとおりです: ${topic}。${otherAgentName} は先ほどこう述べました: "${previousResponse}"。その主張に反応してください。`
  }

// テキストの応答を生成
  const { text } = await agent.generate(prompt, {
    temperature: 0.9,
  });

`${agent.name} が発言中…`

// 音声に変換して再生
  const audioStream = await agent.voice.speak(text, {
    speed: 1.2,
'wav', // 任意: 応答フォーマットを指定
  });

  if (audioStream) {
    audioStream.on('data', chunk => {
      recorder.write(chunk);
    });
  }

`${agent.name} の発言:`

// 表示を見やすくするため、テキストを80文字で折り返し
  const formattedText = formatText(text, 80);
  p.note(formattedText, agent.name);

  if (audioStream) {
    const speaker = playAudio(audioStream);

    await new Promise<void>(resolve => {
      speaker.once('close', () => {
        resolve();
      });
    });
  }

  return text;
}

// 討論を実行するメイン関数
export async function runDebate(topic: string, turns: number = 3) {
  recorder.start();

'AI 討論 - 2人のエージェントがトピックを議論'
`次のトピックで討論を開始します: ${topic}`
`討論は各自 ${turns} ターン行います。いつでも Ctrl+C で終了できます。`

  let optimistResponse = '';
  let skepticResponse = '';
  const responses = [];

  for (let turn = 1; turn <= turns; turn++) {
`ターン ${turn}`

// 楽観派のターン
    optimistResponse = await processTurn('optimistAgent', 'Skeptic', topic, skepticResponse);

    responses.push({
      agent: 'Optimist',
      text: optimistResponse,
    });

// 懐疑派のターン
    skepticResponse = await processTurn('skepticAgent', 'Optimist', topic, optimistResponse);

    responses.push({
      agent: 'Skeptic',
      text: skepticResponse,
    });
  }

  recorder.end();
'討論が終了しました。音声全体は debate.mp3 に保存されました'

  return responses;
}
```

## コマンドラインから討論を実行する \{#running-the-debate-from-the-command-line\}

コマンドラインから討論を実行するための簡単なスクリプトは次のとおりです。

```typescript filename="src/index.ts"
import { runDebate } from './debate/turn-taking';
import * as p from '@clack/prompts';

async function main() {
  // Get the topic from the user
  const topic = await p.text({
    message: 'エージェントに議論させたいトピックを入力してください：',
    placeholder: '気候変動',
    validate(value) {
      if (!value) return 'トピックを入力してください';
      return;
    },
  });

  // キャンセルされた場合は終了
  if (p.isCancel(topic)) {
    p.cancel('操作をキャンセルしました。');
    process.exit(0);
  }

  // ターン数を取得
  const turnsInput = await p.text({
    message: '各エージェントの持ちターン数は？',
    placeholder: '3',
    initialValue: '3',
    validate(value) {
      const num = parseInt(value);
      if (isNaN(num) || num < 1) return '1以上の数値を入力してください';
      return;
    },
  });

  // キャンセルされた場合は終了
  if (p.isCancel(turnsInput)) {
    p.cancel('操作をキャンセルしました。');
    process.exit(0);
  }

  const turns = parseInt(turnsInput as string);

  // ディベートを実行
  await runDebate(topic as string, turns);
}

main().catch(error => {
  p.log.error('エラーが発生しました：');
  console.error(error);
  process.exit(1);
});
```

## 議論用のウェブインターフェースを作成する \{#creating-a-web-interface-for-the-debate\}

ウェブアプリ向けに、ユーザーが議論を開始し、エージェントの応答を聞けるシンプルな Next.js コンポーネントを作成できます。

```tsx filename="app/components/DebateInterface.tsx"
'use client';

import { useState, useRef } from 'react';
import { MastraClient } from '@mastra/client-js';

const mastraClient = new MastraClient({
  baseUrl: process.env.NEXT_PUBLIC_MASTRA_URL || 'http://localhost:4111',
});

export default function DebateInterface() {
  const [topic, setTopic] = useState('');
  const [turns, setTurns] = useState(3);
  const [isDebating, setIsDebating] = useState(false);
  const [responses, setResponses] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Function to start the debate
  const startDebate = async () => {
    if (!topic) return;

    setIsDebating(true);
    setResponses([]);

    try {
      const optimist = mastraClient.getAgent('optimistAgent');
      const skeptic = mastraClient.getAgent('skepticAgent');

      const newResponses = [];
      let optimistResponse = '';
      let skepticResponse = '';

      for (let turn = 1; turn <= turns; turn++) {
        // Optimist's turn
        let prompt;
        if (turn === 1) {
          prompt = `このトピックについて議論してください: ${topic}。あなたの見解を述べてください。`;
        } else {
          prompt = `トピック: ${topic}。Skeptic は次のように述べました: 「${skepticResponse}」。その指摘に反論・返答してください。`;
        }

        const optimistResult = await optimist.generate({
          messages: [{ role: 'user', content: prompt }],
        });

        optimistResponse = optimistResult.text;
        newResponses.push({
          agent: '楽観主義者',
          text: optimistResponse,
        });

        // 各応答の後にUIを更新
        setResponses([...newResponses]);

        // Skeptic's turn
        prompt = `トピック: ${topic}。楽観主義者は次のように述べました: 「${optimistResponse}」。その指摘に反論・返答してください。`;

        const skepticResult = await skeptic.generate({
          messages: [{ role: 'user', content: prompt }],
        });

        skepticResponse = skepticResult.text;
        newResponses.push({
          agent: '懐疑主義者',
          text: skepticResponse,
        });

        // 各応答の後にUIを更新
        setResponses([...newResponses]);
      }
    } catch (error) {
      console.error('討論の開始時にエラーが発生しました:', error);
    } finally {
      setIsDebating(false);
    }
  };

  // 特定の応答の音声を再生する関数
  const playAudio = async (text: string, agent: string) => {
    if (isPlaying) return;

    try {
      setIsPlaying(true);
      const agentClient = mastraClient.getAgent(agent === 'Optimist' ? 'optimistAgent' : 'skepticAgent');

      const audioResponse = await agentClient.voice.speak(text);

      if (!audioResponse.body) {
        throw new Error('音声ストリームを受信できませんでした');
      }

      // Convert stream to blob
      const reader = audioResponse.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // ストリームをBlobに変換
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(url);
        };
        audioRef.current.play();
      }
    } catch (error) {
      console.error('音声の再生中にエラーが発生しました:', error);
      setIsPlaying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">ターン制AI討論</h1>

      <div className="mb-6">
        <label className="block mb-2">討論トピック:</label>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="例: 気候変動、AI倫理、宇宙探査"
        />
      </div>

      <div className="mb-6">
        <label className="block mb-2">ターン数（各エージェント）:</label>
        <input
          type="number"
          value={turns}
          onChange={e => setTurns(parseInt(e.target.value))}
          min={1}
          max={10}
          className="w-full p-2 border rounded"
        />
      </div>

      <button
        onClick={startDebate}
        disabled={isDebating || !topic}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
      >
        {isDebating ? '討論進行中…' : '討論を開始'}
      </button>

      <audio ref={audioRef} className="hidden" />

      {responses.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">討論の書き起こし</h2>

          <div className="space-y-4">
            {responses.map((response, index) => (
              <div
                key={index}
                className={`p-4 rounded ${response.agent === 'Optimist' ? 'bg-blue-100' : 'bg-gray-100'}`}
              >
                <div className="flex justify-between items-center">
                  <div className="font-bold">{response.agent}:</div>
                  <button
                    onClick={() => playAudio(response.text, response.agent)}
                    disabled={isPlaying}
                    className="text-sm px-2 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
                  >
                    {isPlaying ? '再生中…' : '再生'}
                  </button>
                </div>
                <p className="mt-2">{response.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

この例では、Mastra を用いて、ターン制でやり取りするマルチエージェント会話システムの作り方を紹介します。エージェントはユーザーが選んだトピックについて議論し、各エージェントが直前の発言に応答していきます。さらに、各エージェントの応答を音声に変換し、臨場感のあるディベート体験を提供します。

GitHub リポジトリで、ターン制 AI ディベートの完全な実装をご覧いただけます。

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
  "https://github.com/mastra-ai/voice-examples/tree/main/text-to-speech/turn-taking"
}
/>