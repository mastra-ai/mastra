---
sidebar_position: 3
title: "ワークフロー: AIリクルーター"
description: MastraでLLMを活用して候補者情報を収集・処理する採用ワークフローの構築ガイド。
---

# AI リクルーターを構築する \{#building-an-ai-recruiter\}

このガイドでは、Mastra が LLM を用いたワークフローの構築をどのように支援するかを学びます。

候補者の履歴書から情報を抽出し、候補者のプロフィールに応じて技術面の質問か行動面の質問のいずれかに分岐するワークフローを作成します。進めながら、ワークフローの各ステップの組み立て方、分岐の処理方法、LLM 呼び出しの統合方法を確認していきます。

## 前提条件 \{#prerequisites\}

* Node.js `v20.0` 以降がインストールされていること
* サポート対象の[モデルプロバイダー](/docs/models/providers)の API キー
* Mastra の既存プロジェクト（新規プロジェクトのセットアップは[インストールガイド](/docs/getting-started/installation)を参照）

## ワークフローの構築 \{#building-the-workflow\}

ワークフローを設定し、候補者データの抽出と分類の手順を定義してから、適切なフォローアップの質問を行います。

### ワークフローの定義 \{#define-the-workflow\}

新しいファイル `src/mastra/workflows/candidate-workflow.ts` を作成し、ワークフローを定義します。

```ts copy filename="src/mastra/workflows/candidate-workflow.ts"
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

export const candidateWorkflow = createWorkflow({
  id: 'candidate-workflow',
    resumeText: z.string(),
    履歴書テキスト: z.string(),
  }),
  outputSchema: z.object({
    askAboutSpecialty: z.object({
      質問: z.string(),
    }),
    askAboutRole: z.object({
      質問: z.string(),
    }),
  }),
}).commit();
```

### ステップ: 候補者情報の収集 \{#step-gather-candidate-info\}

履歴書テキストから候補者の詳細を抽出し、対象者を「technical」または「non-technical」に分類します。このステップでは LLM を呼び出して履歴書を解析し、氏名、技術的ステータス、専門分野、元の履歴書テキストを含む構造化 JSON を返します。`inputSchema` により `execute()` 内で `resumeText` にアクセスできるので、これを使って LLM にプロンプトを送り、整理されたフィールドを返してください。

既存の `src/mastra/workflows/candidate-workflow.ts` ファイルに次を追加します:

```ts copy filename="src/mastra/workflows/candidate-workflow.ts"
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

const recruiter = new Agent({
  name: 'Recruiter Agent',
  instructions: `あなたは採用担当者です。`,
  model: openai('gpt-4o-mini'),
});

const gatherCandidateInfo = createStep({
  id: 'gatherCandidateInfo',
  inputSchema: z.object({
    resumeText: z.string(),
  }),
  outputSchema: z.object({
    candidateName: z.string(),
    isTechnical: z.boolean(),
    specialty: z.string(),
    resumeText: z.string(),
  }),
  execute: async ({ inputData }) => {
    const resumeText = inputData?.resumeText;

    const prompt = `以下の履歴書から詳細情報を抽出してください:
"${resumeText}"`;

    const res = await recruiter.generate(prompt, {
      structuredOutput: {
        schema: z.object({
          candidateName: z.string(),
          isTechnical: z.boolean(),
          specialty: z.string(),
          resumeText: z.string(),
        }),
      },
      maxSteps: 1,
    });

    return res.object;
  },
});
```

`execute()` 内で Recruiter エージェントを使用しているため、ステップの前でその定義を行い、必要なインポートを追加する必要があります。

### ステップ：技術的な質問 \{#step-technical-question\}

このステップでは、「技術職」と判断された候補者に対し、どのようにその専門分野に進んだのかについて詳しく尋ねます。履歴書の全文を使用して、LLM が関連性の高いフォローアップ質問を作成できるようにします。

既存の `src/mastra/workflows/candidate-workflow.ts` ファイルに次を追加してください：

```ts copy filename="src/mastra/workflows/candidate-workflow.ts"
const askAboutSpecialty = createStep({
  id: 'askAboutSpecialty',
  inputSchema: z.object({
    candidateName: z.string(),
    isTechnical: z.boolean(),
    specialty: z.string(),
    resumeText: z.string(),
  }),
  outputSchema: z.object({
    question: z.string(),
  }),
  execute: async ({ inputData: candidateInfo }) => {
    const prompt = `あなたは採用担当者です。以下の履歴書を参考に、${candidateInfo?.candidateName}さんが「${candidateInfo?.specialty}」の分野に進むことになったきっかけについて、簡潔な質問を作成してください。
履歴書: ${candidateInfo?.resumeText}`;
Resume: ${candidateInfo?.resumeText}`;
    const res = await recruiter.generate(prompt);

    return { question: res?.text?.trim() || '' };
  },
});
```

### ステップ: 行動面の質問 \{#step-behavioral-question\}

候補者が「非技術系」の場合は、別のフォローアップ質問が必要です。このステップでは、履歴書全文を参照しつつ、その役割の何に最も関心があるかを尋ねます。`execute()` 関数は、LLM に役割へフォーカスした質問の作成を促します。

既存の `src/mastra/workflows/candidate-workflow.ts` ファイルに次を追加します:

```ts filename="src/mastra/workflows/candidate-workflow.ts" copy
const askAboutRole = createStep({
  id: 'askAboutRole',
  inputSchema: z.object({
    candidateName: z.string(),
    isTechnical: z.boolean(),
    specialty: z.string(),
    resumeText: z.string(),
  }),
  outputSchema: z.object({
    question: z.string(),
  }),
  execute: async ({ inputData: candidateInfo }) => {
    const prompt = `あなたは採用担当者です。以下の履歴書を参考に、
${candidateInfo?.candidateName}に対して、このポジションについて最も興味を持っている点を尋ねる短い質問を作成してください。
履歴書: ${candidateInfo?.resumeText}`;
    const res = await recruiter.generate(prompt);
    return { question: res?.text?.trim() || '' };
  },
});
```

### ワークフローにステップを追加する \{#add-steps-to-the-workflow\}

ここでは、候補者の技術的ステータスに基づく分岐ロジックを実装するために、ステップを組み合わせます。ワークフローは最初に候補者データを収集し、その後、`isTechnical` に応じて専門分野について尋ねるか、役割について尋ねます。これは、`gatherCandidateInfo` を `askAboutSpecialty` と `askAboutRole` にチェーンすることで実現します。

既存の `src/mastra/workflows/candidate-workflow.ts` ファイルで、`candidateWorkflow` を次のように変更します:

```ts filename="src/mastra/workflows/candidate-workflow.ts" copy {10-14}
export const candidateWorkflow = createWorkflow({
  id: 'candidate-workflow',
  inputSchema: z.object({
    resumeText: z.string(),
  }),
  outputSchema: z.object({
    askAboutSpecialty: z.object({
      question: z.string(),
    }),
    askAboutRole: z.object({
      question: z.string(),
    }),
  }),
})
  .then(gatherCandidateInfo)
  .branch([
    [async ({ inputData: { isTechnical } }) => isTechnical, askAboutSpecialty],
    [async ({ inputData: { isTechnical } }) => !isTechnical, askAboutRole],
  ])
  .commit();
```

### Mastra にワークフローを登録する \{#register-the-workflow-with-mastra\}

`src/mastra/index.ts` ファイルでワークフローを登録します：

```ts copy filename="src/mastra/index.ts" {2, 5}
import { Mastra } from '@mastra/core';
import { candidateWorkflow } from './workflows/candidate-workflow';

export const mastra = new Mastra({
  workflows: { candidateWorkflow },
});
```

## ワークフローのテスト \{#testing-the-workflow\}

開発サーバーを起動して、Mastra の[Playground](/docs/getting-started/local-dev-playground)内でワークフローをテストできます。

```bash copy
mastra dev
```

サイドバーで **Workflows** に移動し、**candidate-workflow** を選択します。中央にはワークフローのグラフビューが表示され、右側のサイドバーではデフォルトで **Run** タブが選択されています。このタブで履歴書のテキストを入力できます。たとえば、次のように入力します：

```text copy
10年以上のソフトウェア開発経験を持つ知識豊富なソフトウェアエンジニア。ソフトウェアデータベースの設計・開発、ユーザーインターフェースの最適化において確かな専門知識を保有。
```

履歴書のテキストを入力したら、**Run** ボタンを押します。すると、ワークフローの各ステップの出力を含む 2 つのステータスボックス（`GatherCandidateInfo` と `AskAboutSpecialty`）が表示されます。

また、[`.createRunAsync()`](/docs/reference/workflows/run) と [`.start()`](/docs/reference/workflows/run-methods/start) を呼び出して、プログラムからワークフローをテストすることもできます。新しいファイル `src/test-workflow.ts` を作成し、次のコードを追加します。

```ts copy filename="src/test-workflow.ts"
import { mastra } from './mastra';

const run = await mastra.getWorkflow('candidateWorkflow').createRunAsync();

const res = await run.start({
  inputData: {
    resumeText:
      '10年以上のソフトウェア開発経験を持つ知識豊富なソフトウェアエンジニア。ソフトウェアデータベースの設計・開発、およびユーザーインターフェースの最適化における実証済みの専門知識。',
  },
});

// ワークフロー結果全体をダンプ(ステータス、ステップ、結果を含む)
console.log(JSON.stringify(res, null, 2));

// ワークフローの出力値を取得
if (res.status === 'success') {
  const question = res.result.askAboutRole?.question ?? res.result.askAboutSpecialty?.question;

  console.log(`出力値: ${question}`);
}
```

では、ワークフローを実行して、ターミナルで出力を確認しましょう：

```bash copy
npx tsx src/test-workflow.ts
```

履歴書を解析し、候補者の技術スキルに基づいてどの質問をするかを判断するワークフローをちょうど作成したところです。おめでとうございます、楽しいハッキングを！
