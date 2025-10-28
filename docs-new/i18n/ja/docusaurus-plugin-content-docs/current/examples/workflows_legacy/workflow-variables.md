---
title: "ワークフロー変数によるデータマッピング（旧式）"
description: "Mastra のワークフローで、ステップ間のデータをマッピングするためにワークフロー変数を使う方法を学びます。"
---

# ワークフロー変数によるデータ マッピング（レガシー） \{#data-mapping-with-workflow-variables-legacy\}

この例では、Mastra のワークフローにおいて、ステップ間でデータをマッピングするためにワークフロー変数を使う方法を示します。

## ユースケース：ユーザー登録プロセス \{#use-case-user-registration-process\}

この例では、以下を行うシンプルなユーザー登録ワークフローを作成します：

1. ユーザー入力を検証する
2. ユーザーデータを整える
3. ユーザープロフィールを作成する

## 実装 \{#implementation\}

```typescript showLineNumbers filename="src/mastra/workflows/user-registration.ts" copy
import { LegacyStep, LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

// 型安全性を高めるためのスキーマを定義
const userInputSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  age: z.number().min(18),
});

const validatedDataSchema = z.object({
  isValid: z.boolean(),
  validatedData: z.object({
    email: z.string(),
    name: z.string(),
    age: z.number(),
  }),
});

const formattedDataSchema = z.object({
  userId: z.string(),
  formattedData: z.object({
    email: z.string(),
    displayName: z.string(),
    ageGroup: z.string(),
  }),
});

const profileSchema = z.object({
  profile: z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
    ageGroup: z.string(),
    createdAt: z.string(),
  }),
});

// ワークフローの定義
const registrationWorkflow = new LegacyWorkflow({
  name: 'user-registration',
  triggerSchema: userInputSchema,
});

// ステップ 1: ユーザー入力の検証
const validateInput = new LegacyStep({
  id: 'validateInput',
  inputSchema: userInputSchema,
  outputSchema: validatedDataSchema,
  execute: async ({ context }) => {
    const { email, name, age } = context;

// 簡易的なバリデーションロジック
    const isValid = email.includes('@') && name.length > 0 && age >= 18;

    return {
      isValid,
      validatedData: {
        email: email.toLowerCase().trim(),
        name,
        age,
      },
    };
  },
});

// ステップ 2: ユーザーデータのフォーマット
const formatUserData = new LegacyStep({
  id: 'formatUserData',
  inputSchema: z.object({
    validatedData: z.object({
      email: z.string(),
      name: z.string(),
      age: z.number(),
    }),
  }),
  outputSchema: formattedDataSchema,
  execute: async ({ context }) => {
    const { validatedData } = context;

// シンプルなユーザーIDを生成
    const userId = `user_${Math.floor(Math.random() * 10000)}`;

// データをフォーマット
    const ageGroup = validatedData.age < 30 ? 'young-adult' : 'adult';

    return {
      userId,
      formattedData: {
        email: validatedData.email,
        displayName: validatedData.name,
        ageGroup,
      },
    };
  },
});

// ステップ 3: ユーザープロフィールの作成
const createUserProfile = new LegacyStep({
  id: 'createUserProfile',
  inputSchema: z.object({
    userId: z.string(),
    formattedData: z.object({
      email: z.string(),
      displayName: z.string(),
      ageGroup: z.string(),
    }),
  }),
  outputSchema: profileSchema,
  execute: async ({ context }) => {
    const { userId, formattedData } = context;

// 実際のアプリではここでデータベースに保存する

    return {
      profile: {
        id: userId,
        ...formattedData,
        createdAt: new Date().toISOString(),
      },
    };
  },
});

// 変数マッピングを用いてワークフローを構築
registrationWorkflow
  // 最初のステップはトリガーからデータを取得する
  .step(validateInput, {
    variables: {
      email: { step: 'trigger', path: 'email' },
      name: { step: 'trigger', path: 'name' },
      age: { step: 'trigger', path: 'age' },
    },
  })
  // 直前のステップの検証済みデータでユーザーデータをフォーマット
  .then(formatUserData, {
    variables: {
      validatedData: { step: validateInput, path: 'validatedData' },
    },
    when: {
      ref: { step: validateInput, path: 'isValid' },
      query: { $eq: true },
    },
  })
  // フォーマット済みデータを用いてプロフィールを作成
  .then(createUserProfile, {
    variables: {
      userId: { step: formatUserData, path: 'userId' },
      formattedData: { step: formatUserData, path: 'formattedData' },
    },
  })
  .commit();

export default registrationWorkflow;
```

## この例の使い方 \{#how-to-use-this-example\}

1. 上記のとおりファイルを作成する
2. Mastra インスタンスにワークフローを登録する
3. ワークフローを実行する:

```bash
curl --location 'http://localhost:4111/api/workflows/user-registration/start-async' \
     --header 'Content-Type: application/json' \
     --data '{
       "email": "user@example.com",
       "name": "John Doe",
       "age": 25
     }'
```

## 重要なポイント \{#key-takeaways\}

この例は、ワークフロー変数に関するいくつかの重要な概念を示しています：

1. **データマッピング**：変数は、あるステップから別のステップへデータをマッピングし、明確なデータフローを形成します。

2. **パスの参照**：`path` プロパティは、ステップの出力のどの部分を使用するかを指定します。

3. **条件付き実行**：`when` プロパティにより、前のステップの出力に基づいてステップを条件付きで実行できます。

4. **型安全性**：各ステップは型安全性のために入力・出力スキーマを定義し、ステップ間で受け渡されるデータが適切に型付けされていることを保証します。

5. **データ依存関係の明示**：入力スキーマを定義し、変数マッピングを用いることで、ステップ間のデータ依存関係が明確に示されます。

ワークフロー変数の詳細については、[StepOptions リファレンス](/docs/reference/legacyWorkflows/step-options)を参照してください。

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクは、レガシー版ワークフローのサンプルドキュメントです：

* [シンプルなワークフローの作成（レガシー）](/docs/examples/workflows_legacy/creating-a-workflow)
* [順次ステップのワークフロー（レガシー）](/docs/examples/workflows_legacy/sequential-steps)
* [ステップの並列実行（レガシー）](/docs/examples/workflows_legacy/parallel-steps)
* [分岐パス（レガシー）](/docs/examples/workflows_legacy/branching-paths)
* [条件分岐付きワークフロー（レガシー、実験的）](/docs/examples/workflows_legacy/conditional-branching)
* [ワークフロー（レガシー）からのエージェント呼び出し](/docs/examples/workflows_legacy/calling-agent)
* [ツールをワークフローのステップとして使用（レガシー）](/docs/examples/workflows_legacy/using-a-tool-as-a-step)
* [循環依存を含むワークフロー（レガシー）](/docs/examples/workflows_legacy/cyclical-dependencies)
* [Human-in-the-Loop ワークフロー（レガシー）](/docs/examples/workflows_legacy/human-in-the-loop)
* [一時停止と再開に対応したワークフロー（レガシー）](/docs/examples/workflows_legacy/suspend-and-resume)