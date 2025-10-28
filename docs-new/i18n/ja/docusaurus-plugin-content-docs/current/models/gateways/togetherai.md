---
title: "Together AI"
description: "Together AI で AI モデルを利用する"
---

# <img src="https://models.dev/logos/togetherai.svg" alt="Together AI logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Together AI \{#together-ai\}

Together AI は、複数のプロバイダーが提供するモデルを集約し、レート制限やフェイルオーバーなどの拡張機能を備えています。Mastra のモデルルーターを通じて 6 つのモデルにアクセスできます。

詳しくは [Together AI のドキュメント](https://docs.together.ai/docs/serverless-models)をご覧ください。

## 使い方 \{#usage\}

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'togetherai/Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8',
});
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Together AI のドキュメント](https://docs.together.ai/docs/serverless-models)をご確認ください。

:::

## 設定 \{#configuration\}

```bash
# ゲートウェイAPIキーを使用
TOGETHERAI_API_KEY=your-gateway-key

# または各プロバイダーのAPIキーを直接使用
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=ant-...
```

## 利用可能なモデル \{#available-models\}

| モデル |
| --- |
| `Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8` |
| `deepseek-ai/DeepSeek-R1` |
| `deepseek-ai/DeepSeek-V3` |
| `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| `moonshotai/Kimi-K2-Instruct` |
| `openai/gpt-oss-120b` |