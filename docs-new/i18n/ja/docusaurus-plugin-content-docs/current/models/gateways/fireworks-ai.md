---
title: "Fireworks AI"
description: "Fireworks AI で AI モデルを利用する。"
---

# <img src="https://models.dev/logos/fireworks-ai.svg" alt="Fireworks AI logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Fireworks AI \{#fireworks-ai\}

Fireworks AIは、レート制限やフェイルオーバーなどの拡張機能を備え、複数のプロバイダーのモデルを集約します。Mastraのモデルルーターを通じて、10種類のモデルにアクセスできます。

詳しくは[Fireworks AIのドキュメント](https://fireworks.ai/docs/)をご覧ください。

## 使い方 \{#usage\}

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切で役に立つアシスタントです',
  model: 'fireworks-ai/accounts/fireworks/models/deepseek-r1-0528',
});
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Fireworks AI のドキュメント](https://fireworks.ai/docs/)をご確認ください。

:::

## 設定 \{#configuration\}

```bash
# ゲートウェイのAPIキーを使用する
FIREWORKS-AI_API_KEY=your-gateway-key

# もしくはプロバイダーのAPIキーを直接使用する
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=ant-...
```

## 利用可能なモデル \{#available-models\}

| モデル                                                     |
| ---------------------------------------------------------- |
| `accounts/fireworks/models/deepseek-r1-0528`               |
| `accounts/fireworks/models/deepseek-v3-0324`               |
| `accounts/fireworks/models/deepseek-v3p1`                  |
| `accounts/fireworks/models/glm-4p5`                        |
| `accounts/fireworks/models/glm-4p5-air`                    |
| `accounts/fireworks/models/gpt-oss-120b`                   |
| `accounts/fireworks/models/gpt-oss-20b`                    |
| `accounts/fireworks/models/kimi-k2-instruct`               |
| `accounts/fireworks/models/qwen3-235b-a22b`                |
| `accounts/fireworks/models/qwen3-coder-480b-a35b-instruct` |