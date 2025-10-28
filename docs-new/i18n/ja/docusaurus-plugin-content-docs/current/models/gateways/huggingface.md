---
title: "Hugging Face"
description: "Hugging Face で AI モデルを利用する。"
---

# <img src="https://models.dev/logos/huggingface.svg" alt="Hugging Face logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Hugging Face \{#hugging-face\}

Hugging Face は、レート制限やフェイルオーバーなどの拡張機能を備え、複数のプロバイダーから提供されるモデルを集約します。Mastra のモデルルーターを通じて、11 個のモデルにアクセスできます。

詳細は [Hugging Face のドキュメント](https://huggingface.co)をご覧ください。

## 使い方 \{#usage\}

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'huggingface/Qwen/Qwen3-235B-A22B-Thinking-2507',
});
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Hugging Face のドキュメント](https://huggingface.co) をご確認ください。

:::

## 構成 \{#configuration\}

```bash
# ゲートウェイAPIキーを使用
HUGGINGFACE_API_KEY=your-gateway-key

# またはプロバイダーのAPIキーを直接使用
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=ant-...
```

## 利用可能なモデル \{#available-models\}

| モデル |
| --- |
| `Qwen/Qwen3-235B-A22B-Thinking-2507` |
| `Qwen/Qwen3-Coder-480B-A35B-Instruct` |
| `Qwen/Qwen3-Next-80B-A3B-Instruct` |
| `Qwen/Qwen3-Next-80B-A3B-Thinking` |
| `deepseek-ai/DeepSeek-R1-0528` |
| `deepseek-ai/Deepseek-V3-0324` |
| `moonshotai/Kimi-K2-Instruct` |
| `moonshotai/Kimi-K2-Instruct-0905` |
| `zai-org/GLM-4.5` |
| `zai-org/GLM-4.5-Air` |
| `zai-org/GLM-4.6` |