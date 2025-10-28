---
title: "Vercel "
description: "Vercel で AI モデルを利用する。"
---

# <img src="https://models.dev/logos/vercel.svg" alt="Vercel logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Vercel \{#vercel\}

Vercel は、レート制限やフェイルオーバーなどの拡張機能を備え、複数プロバイダーのモデルを統合します。Mastra のモデルルーター経由で 63 種類のモデルにアクセスできます。

詳しくは [Vercel のドキュメント](https://ai-sdk.dev/providers/ai-sdk-providers)をご覧ください。

## 使い方 \{#usage\}

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'vercel/amazon/nova-lite',
});
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Vercel のドキュメント](https://ai-sdk.dev/providers/ai-sdk-providers)をご確認ください。

:::

## 設定 \{#configuration\}

```bash
# ゲートウェイAPIキーを使用
VERCEL_API_KEY=your-gateway-key

# またはプロバイダーのAPIキーを直接使用
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=ant-...
```

## 利用可能なモデル \{#available-models\}

| モデル |
| --- |
| `amazon/nova-lite` |
| `amazon/nova-micro` |
| `amazon/nova-pro` |
| `anthropic/claude-3-5-haiku` |
| `anthropic/claude-3-haiku` |
| `anthropic/claude-3-opus` |
| `anthropic/claude-3.5-sonnet` |
| `anthropic/claude-3.7-sonnet` |
| `anthropic/claude-4-1-opus` |
| `anthropic/claude-4-opus` |
| `anthropic/claude-4-sonnet` |
| `anthropic/claude-4.5-sonnet` |
| `cerebras/qwen3-coder` |
| `deepseek/deepseek-r1` |
| `deepseek/deepseek-r1-distill-llama-70b` |
| `google/gemini-2.0-flash` |
| `google/gemini-2.0-flash-lite` |
| `google/gemini-2.5-flash` |
| `google/gemini-2.5-pro` |
| `meta/llama-3.3-70b` |
| `meta/llama-4-maverick` |
| `meta/llama-4-scout` |
| `mistral/codestral` |
| `mistral/magistral-medium` |
| `mistral/magistral-small` |
| `mistral/ministral-3b` |
| `mistral/ministral-8b` |
| `mistral/mistral-large` |
| `mistral/mistral-small` |
| `mistral/mixtral-8x22b-instruct` |
| `mistral/pixtral-12b` |
| `mistral/pixtral-large` |
| `moonshotai/kimi-k2` |
| `morph/morph-v3-fast` |
| `morph/morph-v3-large` |
| `openai/gpt-4-turbo` |
| `openai/gpt-4.1` |
| `openai/gpt-4.1-mini` |
| `openai/gpt-4.1-nano` |
| `openai/gpt-4o` |
| `openai/gpt-4o-mini` |
| `openai/gpt-5` |
| `openai/gpt-5-codex` |
| `openai/gpt-5-mini` |
| `openai/gpt-5-nano` |
| `openai/gpt-oss-120b` |
| `openai/gpt-oss-20b` |
| `openai/o1` |
| `openai/o3` |
| `openai/o3-mini` |
| `openai/o4-mini` |
| `vercel/v0-1.0-md` |
| `vercel/v0-1.5-md` |
| `xai/grok-2` |
| `xai/grok-2-vision` |
| `xai/grok-3` |
| `xai/grok-3-fast` |
| `xai/grok-3-mini` |
| `xai/grok-3-mini-fast` |
| `xai/grok-4` |
| `xai/grok-4-fast` |
| `xai/grok-4-fast-non-reasoning` |
| `xai/grok-code-fast-1` |