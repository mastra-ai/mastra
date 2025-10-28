---
title: "Netlify"
description: "Netlify 経由で AI モデルを利用する。"
---

# <NetlifyLogo className="inline w-8 h-8 mr-2 align-middle" />Netlify \{#netlify\}

Netlify AI Gateway は、キャッシュや可観測性を備え、複数プロバイダーへの一元的なアクセスを提供します。Mastra のモデルルーター経由で 33 種類のモデルにアクセスできます。

詳細は [Netlify ドキュメント](https://docs.netlify.com/build/ai-gateway/overview/)をご覧ください。

## 使い方 \{#usage\}

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは有用なアシスタントです',
  model: 'netlify/anthropic/claude-opus-4-20250514',
});
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Netlify ドキュメント](https://docs.netlify.com/build/ai-gateway/overview/)をご確認ください。

:::

## 設定 \{#configuration\}

```bash
# ゲートウェイAPIキーを使用
NETLIFY_API_KEY=your-gateway-key

# またはプロバイダーのAPIキーを直接使用
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=ant-...
```

## 利用可能なモデル \{#available-models\}

| モデル                                          |
| ---------------------------------------------- |
| `anthropic/claude-opus-4-20250514`             |
| `anthropic/claude-3-7-sonnet-20250219`         |
| `anthropic/claude-3-7-sonnet-latest`           |
| `anthropic/claude-3-haiku-20240307`            |
| `anthropic/claude-opus-4-1-20250805`           |
| `anthropic/claude-sonnet-4-5-20250929`         |
| `anthropic/claude-sonnet-4-20250514`           |
| `anthropic/claude-3-5-haiku-20241022`          |
| `anthropic/claude-3-5-haiku-latest`            |
| `gemini/gemini-2.0-flash-lite`                 |
| `gemini/gemini-2.5-flash-image-preview`        |
| `gemini/gemini-2.5-pro`                        |
| `gemini/gemini-flash-latest`                   |
| `gemini/gemini-2.5-flash-preview-09-2025`      |
| `gemini/gemini-flash-lite-latest`              |
| `gemini/gemini-2.5-flash`                      |
| `gemini/gemini-2.5-flash-lite-preview-09-2025` |
| `gemini/gemini-2.5-flash-lite`                 |
| `gemini/gemini-2.0-flash`                      |
| `openai/gpt-4o`                                |
| `openai/gpt-4o-mini`                           |
| `openai/o4-mini`                               |
| `openai/o3`                                    |
| `openai/gpt-5-pro`                             |
| `openai/gpt-5`                                 |
| `openai/gpt-5-codex`                           |
| `openai/gpt-5-mini`                            |
| `openai/gpt-5-nano`                            |
| `openai/gpt-4.1`                               |
| `openai/o3-mini`                               |
| `openai/codex-mini-latest`                     |
| `openai/gpt-4.1-mini`                          |
| `openai/gpt-4.1-nano`                          |