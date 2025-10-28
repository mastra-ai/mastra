---
title: "Groq "
description: "Groq 経由で AI モデルを利用する。"
---

# <img src="https://models.dev/logos/groq.svg" alt="Groq logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Groq \{#groq\}

Groqは、複数のプロバイダーのモデルを集約し、レート制限やフェイルオーバーなどの強化機能を備えています。Mastraのモデルルーター経由で、17種のモデルにアクセスできます。

詳しくは [Groqのドキュメント](https://console.groq.com/docs/models)をご覧ください。

## 使い方 \{#usage\}

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは有能なアシスタントです',
  model: 'groq/deepseek-r1-distill-llama-70b',
});
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Groq ドキュメント](https://console.groq.com/docs/models)をご確認ください。

:::

## 構成 \{#configuration\}

```bash
# ゲートウェイAPIキーを使用
GROQ_API_KEY=your-gateway-key

# またはプロバイダーのAPIキーを直接使用
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=ant-...
```

## 利用可能なモデル \{#available-models\}

| モデル名                                       |
| ----------------------------------------------- |
| `deepseek-r1-distill-llama-70b`                 |
| `gemma2-9b-it`                                  |
| `llama-3.1-8b-instant`                          |
| `llama-3.3-70b-versatile`                       |
| `llama-guard-3-8b`                              |
| `llama3-70b-8192`                               |
| `llama3-8b-8192`                                |
| `meta-llama/llama-4-maverick-17b-128e-instruct` |
| `meta-llama/llama-4-scout-17b-16e-instruct`     |
| `meta-llama/llama-guard-4-12b`                  |
| `mistral-saba-24b`                              |
| `moonshotai/kimi-k2-instruct`                   |
| `moonshotai/kimi-k2-instruct-0905`              |
| `openai/gpt-oss-120b`                           |
| `openai/gpt-oss-20b`                            |
| `qwen-qwq-32b`                                  |
| `qwen/qwen3-32b`                                |