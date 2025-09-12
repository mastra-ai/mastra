/**
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT
 * Generated from model gateway providers
 */

/**
 * Provider configurations for OpenAI-compatible APIs
 */
export const PROVIDER_REGISTRY = {
  "deepseek": {
    "url": "https://api.deepseek.com/chat/completions",
    "apiKeyEnvVar": "DEEPSEEK_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "DeepSeek",
    "models": [
      "deepseek-chat",
      "deepseek-reasoner"
    ]
  },
  "xai": {
    "url": "https://api.x.ai/v1/chat/completions",
    "apiKeyEnvVar": "XAI_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "xAI",
    "models": [
      "grok-2",
      "grok-2-1212",
      "grok-2-latest",
      "grok-2-vision",
      "grok-2-vision-1212",
      "grok-2-vision-latest",
      "grok-3",
      "grok-3-fast",
      "grok-3-fast-latest",
      "grok-3-latest",
      "grok-3-mini",
      "grok-3-mini-fast",
      "grok-3-mini-fast-latest",
      "grok-3-mini-latest",
      "grok-4",
      "grok-beta",
      "grok-vision-beta"
    ]
  },
  "fireworks_ai": {
    "url": "https://api.fireworks.ai/inference/v1/chat/completions",
    "apiKeyEnvVar": "FIREWORKS_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Fireworks AI",
    "models": [
      "accounts/fireworks/gpt-oss-120b",
      "accounts/fireworks/gpt-oss-20b",
      "accounts/fireworks/models/deepseek-r1-0528",
      "accounts/fireworks/models/deepseek-v3-0324",
      "accounts/fireworks/models/deepseek-v3p1",
      "accounts/fireworks/models/glm-4p5",
      "accounts/fireworks/models/glm-4p5-air",
      "accounts/fireworks/models/kimi-k2-instruct",
      "accounts/fireworks/models/qwen3-235b-a22b",
      "accounts/fireworks/models/qwen3-coder-480b-a35b-instruct"
    ]
  },
  "openrouter": {
    "url": "https://openrouter.ai/api/v1/chat/completions",
    "apiKeyEnvVar": "OPENROUTER_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "OpenRouter",
    "models": [
      "anthropic/claude-3.5-haiku",
      "anthropic/claude-3.7-sonnet",
      "anthropic/claude-opus-4",
      "anthropic/claude-opus-4.1",
      "anthropic/claude-sonnet-4",
      "cognitivecomputations/dolphin3.0-mistral-24b",
      "cognitivecomputations/dolphin3.0-r1-mistral-24b",
      "deepseek/deepseek-chat-v3-0324",
      "deepseek/deepseek-chat-v3.1",
      "deepseek/deepseek-r1-0528-qwen3-8b:free",
      "deepseek/deepseek-r1-0528:free",
      "deepseek/deepseek-r1-distill-llama-70b",
      "deepseek/deepseek-r1-distill-qwen-14b",
      "deepseek/deepseek-r1:free",
      "deepseek/deepseek-v3-base:free",
      "featherless/qwerky-72b",
      "google/gemini-2.0-flash-001",
      "google/gemini-2.0-flash-exp:free",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-pro-preview-05-06",
      "google/gemini-2.5-pro-preview-06-05",
      "google/gemma-2-9b-it:free",
      "google/gemma-3-12b-it",
      "google/gemma-3-27b-it",
      "google/gemma-3n-e4b-it",
      "google/gemma-3n-e4b-it:free",
      "meta-llama/llama-3.2-11b-vision-instruct",
      "meta-llama/llama-3.3-70b-instruct:free",
      "meta-llama/llama-4-scout:free",
      "microsoft/mai-ds-r1:free",
      "mistralai/codestral-2508",
      "mistralai/devstral-medium-2507",
      "mistralai/devstral-small-2505",
      "mistralai/devstral-small-2505:free",
      "mistralai/devstral-small-2507",
      "mistralai/mistral-7b-instruct:free",
      "mistralai/mistral-medium-3",
      "mistralai/mistral-medium-3.1",
      "mistralai/mistral-nemo:free",
      "mistralai/mistral-small-3.1-24b-instruct",
      "mistralai/mistral-small-3.2-24b-instruct",
      "mistralai/mistral-small-3.2-24b-instruct:free",
      "moonshotai/kimi-dev-72b:free",
      "moonshotai/kimi-k2",
      "moonshotai/kimi-k2-0905",
      "moonshotai/kimi-k2:free",
      "nousresearch/deephermes-3-llama-3-8b-preview",
      "nousresearch/hermes-4-405b",
      "nousresearch/hermes-4-70b",
      "openai/gpt-4.1",
      "openai/gpt-4.1-mini",
      "openai/gpt-4o-mini",
      "openai/gpt-5",
      "openai/gpt-5-chat",
      "openai/gpt-5-mini",
      "openai/gpt-5-nano",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "openai/o4-mini",
      "openrouter/cypher-alpha:free",
      "openrouter/horizon-alpha",
      "openrouter/horizon-beta",
      "openrouter/sonoma-dusk-alpha",
      "openrouter/sonoma-sky-alpha",
      "qwen/qwen-2.5-coder-32b-instruct",
      "qwen/qwen2.5-vl-32b-instruct:free",
      "qwen/qwen2.5-vl-72b-instruct",
      "qwen/qwen2.5-vl-72b-instruct:free",
      "qwen/qwen3-14b:free",
      "qwen/qwen3-235b-a22b-07-25",
      "qwen/qwen3-235b-a22b-07-25:free",
      "qwen/qwen3-235b-a22b-thinking-2507",
      "qwen/qwen3-235b-a22b:free",
      "qwen/qwen3-30b-a3b-instruct-2507",
      "qwen/qwen3-30b-a3b:free",
      "qwen/qwen3-32b:free",
      "qwen/qwen3-8b:free",
      "qwen/qwen3-coder",
      "qwen/qwen3-coder:free",
      "qwen/qwen3-max",
      "qwen/qwq-32b:free",
      "rekaai/reka-flash-3",
      "sarvamai/sarvam-m:free",
      "thudm/glm-z1-32b:free",
      "tngtech/deepseek-r1t2-chimera:free",
      "x-ai/grok-3",
      "x-ai/grok-3-beta",
      "x-ai/grok-3-mini",
      "x-ai/grok-3-mini-beta",
      "x-ai/grok-4",
      "x-ai/grok-code-fast-1",
      "z-ai/glm-4.5",
      "z-ai/glm-4.5-air",
      "z-ai/glm-4.5-air:free",
      "z-ai/glm-4.5v"
    ]
  },
  "cerebras": {
    "url": "https://api.cerebras.ai/v1/chat/completions",
    "apiKeyEnvVar": "CEREBRAS_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Cerebras",
    "models": [
      "gpt-oss-120b",
      "qwen-3-235b-a22b-instruct-2507",
      "qwen-3-coder-480b"
    ]
  },
  "venice": {
    "url": "https://api.venice.ai/api/v1/chat/completions",
    "apiKeyEnvVar": "VENICE_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Venice AI",
    "models": [
      "deepseek-coder-v2-lite",
      "deepseek-r1-671b",
      "dolphin-2.9.2-qwen2-72b",
      "llama-3.1-405b",
      "llama-3.2-3b",
      "llama-3.3-70b",
      "mistral-31-24b",
      "qwen-2.5-coder-32b",
      "qwen-2.5-qwq-32b",
      "qwen-2.5-vl",
      "qwen3-235b",
      "qwen3-4b",
      "venice-uncensored"
    ]
  },
  "github_copilot": {
    "url": "https://api.githubcopilot.com/chat/completions",
    "apiKeyEnvVar": "GITHUB_TOKEN",
    "apiKeyHeader": "Authorization",
    "name": "GitHub Copilot",
    "models": [
      "claude-3.5-sonnet",
      "claude-3.7-sonnet",
      "claude-3.7-sonnet-thought",
      "claude-opus-4",
      "claude-opus-41",
      "claude-sonnet-4",
      "gemini-2.0-flash-001",
      "gemini-2.5-pro",
      "gpt-4.1",
      "gpt-4o",
      "gpt-5",
      "gpt-5-mini",
      "grok-code-fast-1",
      "o3",
      "o3-mini",
      "o4-mini"
    ]
  },
  "submodel": {
    "url": "https://llm.submodel.ai/v1/chat/completions",
    "apiKeyEnvVar": "SUBMODEL_INSTAGEN_ACCESS_KEY",
    "apiKeyHeader": "Authorization",
    "name": "submodel",
    "models": [
      "Qwen/Qwen3-235B-A22B-Instruct-2507",
      "Qwen/Qwen3-235B-A22B-Thinking-2507",
      "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",
      "deepseek-ai/DeepSeek-R1-0528",
      "deepseek-ai/DeepSeek-V3-0324",
      "deepseek-ai/DeepSeek-V3.1",
      "openai/gpt-oss-120b",
      "zai-org/GLM-4.5-Air",
      "zai-org/GLM-4.5-FP8"
    ]
  },
  "anthropic": {
    "url": "https://api.anthropic.com/v1/chat/completions",
    "apiKeyEnvVar": "ANTHROPIC_API_KEY",
    "apiKeyHeader": "x-api-key",
    "name": "Anthropic",
    "models": [
      "claude-3-5-haiku-20241022",
      "claude-3-5-sonnet-20240620",
      "claude-3-5-sonnet-20241022",
      "claude-3-7-sonnet-20250219",
      "claude-3-haiku-20240307",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-opus-4-1-20250805",
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514"
    ]
  },
  "alibaba": {
    "url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    "apiKeyEnvVar": "DASHSCOPE_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Alibaba",
    "models": [
      "qwen3-coder-plus"
    ]
  },
  "openai": {
    "url": "https://api.openai.com/v1/chat/completions",
    "apiKeyEnvVar": "OPENAI_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "OpenAI",
    "models": [
      "codex-mini-latest",
      "gpt-3.5-turbo",
      "gpt-4",
      "gpt-4-turbo",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-5",
      "gpt-5-chat-latest",
      "gpt-5-mini",
      "gpt-5-nano",
      "o1",
      "o1-mini",
      "o1-preview",
      "o1-pro",
      "o3",
      "o3-deep-research",
      "o3-mini",
      "o3-pro",
      "o4-mini",
      "o4-mini-deep-research"
    ]
  },
  "mistral": {
    "url": "https://api.mistral.ai/v1/chat/completions",
    "apiKeyEnvVar": "MISTRAL_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Mistral",
    "models": [
      "codestral-latest",
      "devstral-medium-2507",
      "devstral-small-2505",
      "devstral-small-2507",
      "magistral-medium-latest",
      "magistral-small",
      "ministral-3b-latest",
      "ministral-8b-latest",
      "mistral-large-latest",
      "mistral-medium-2505",
      "mistral-medium-2508",
      "mistral-medium-latest",
      "mistral-nemo",
      "mistral-small-latest",
      "open-mistral-7b",
      "open-mixtral-8x22b",
      "open-mixtral-8x7b",
      "pixtral-12b",
      "pixtral-large-latest"
    ]
  },
  "upstage": {
    "url": "https://api.upstage.ai/chat/completions",
    "apiKeyEnvVar": "UPSTAGE_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Upstage",
    "models": [
      "solar-mini",
      "solar-pro2"
    ]
  },
  "llama": {
    "url": "https://api.llama.com/compat/v1/chat/completions",
    "apiKeyEnvVar": "LLAMA_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Llama",
    "models": [
      "cerebras-llama-4-maverick-17b-128e-instruct",
      "cerebras-llama-4-scout-17b-16e-instruct",
      "groq-llama-4-maverick-17b-128e-instruct",
      "llama-3.3-70b-instruct",
      "llama-3.3-8b-instruct",
      "llama-4-maverick-17b-128e-instruct-fp8",
      "llama-4-scout-17b-16e-instruct-fp8"
    ]
  },
  "moonshotai_cn": {
    "url": "https://api.moonshot.cn/v1/chat/completions",
    "apiKeyEnvVar": "MOONSHOT_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Moonshot AI (China)",
    "models": [
      "kimi-k2-0711-preview",
      "kimi-k2-0905-preview",
      "kimi-k2-turbo-preview"
    ]
  },
  "deepinfra": {
    "url": "https://api.deepinfra.com/v1/openai/chat/completions",
    "apiKeyEnvVar": "DEEPINFRA_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Deep Infra",
    "models": [
      "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      "Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo",
      "moonshotai/Kimi-K2-Instruct",
      "zai-org/GLM-4.5"
    ]
  },
  "zhipuai": {
    "url": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    "apiKeyEnvVar": "ZHIPU_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Zhipu AI",
    "models": [
      "glm-4.5",
      "glm-4.5-air",
      "glm-4.5-flash",
      "glm-4.5v"
    ]
  },
  "synthetic": {
    "url": "https://api.synthetic.new/v1/chat/completions",
    "apiKeyEnvVar": "SYNTHETIC_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Synthetic",
    "models": [
      "hf:Qwen/Qwen2.5-Coder-32B-Instruct",
      "hf:Qwen/Qwen3-235B-A22B-Instruct-2507",
      "hf:Qwen/Qwen3-235B-A22B-Thinking-2507",
      "hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
      "hf:deepseek-ai/DeepSeek-R1",
      "hf:deepseek-ai/DeepSeek-R1-0528",
      "hf:deepseek-ai/DeepSeek-V3",
      "hf:deepseek-ai/DeepSeek-V3-0324",
      "hf:deepseek-ai/DeepSeek-V3.1",
      "hf:meta-llama/Llama-3.1-405B-Instruct",
      "hf:meta-llama/Llama-3.1-70B-Instruct",
      "hf:meta-llama/Llama-3.1-8B-Instruct",
      "hf:meta-llama/Llama-3.3-70B-Instruct",
      "hf:meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
      "hf:meta-llama/Llama-4-Scout-17B-16E-Instruct",
      "hf:moonshotai/Kimi-K2-Instruct",
      "hf:moonshotai/Kimi-K2-Instruct-0905",
      "hf:openai/gpt-oss-120b",
      "hf:zai-org/GLM-4.5"
    ]
  },
  "modelscope": {
    "url": "https://api-inference.modelscope.cn/v1/chat/completions",
    "apiKeyEnvVar": "MODELSCOPE_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "ModelScope",
    "models": [
      "Qwen/Qwen3-235B-A22B-Instruct-2507",
      "Qwen/Qwen3-235B-A22B-Thinking-2507",
      "Qwen/Qwen3-30B-A3B-Instruct-2507",
      "Qwen/Qwen3-30B-A3B-Thinking-2507",
      "Qwen/Qwen3-Coder-30B-A3B-Instruct",
      "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      "ZhipuAI/GLM-4.5",
      "moonshotai/Kimi-K2-Instruct"
    ]
  },
  "baseten": {
    "url": "https://inference.baseten.co/v1/chat/completions",
    "apiKeyEnvVar": "BASETEN_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Baseten",
    "models": [
      "Moonshotai-Kimi-K2-Instruct-0905",
      "Qwen-Qwen3-Coder-480B-A35B-Instruct"
    ]
  },
  "vercel": {
    "url": "https://ai-gateway.vercel.sh/v1/chat/completions",
    "apiKeyEnvVar": "AI_GATEWAY_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Vercel AI Gateway",
    "models": [
      "amazon/nova-lite",
      "amazon/nova-micro",
      "amazon/nova-pro",
      "anthropic/claude-3-5-haiku",
      "anthropic/claude-3-haiku",
      "anthropic/claude-3-opus",
      "anthropic/claude-3.5-sonnet",
      "anthropic/claude-3.7-sonnet",
      "anthropic/claude-4-1-opus",
      "anthropic/claude-4-opus",
      "anthropic/claude-4-sonnet",
      "cerebras/qwen3-coder",
      "deepseek/deepseek-r1",
      "deepseek/deepseek-r1-distill-llama-70b",
      "google/gemini-2.0-flash",
      "google/gemini-2.0-flash-lite",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-pro",
      "meta/llama-3.3-70b",
      "meta/llama-4-maverick",
      "meta/llama-4-scout",
      "mistral/codestral",
      "mistral/magistral-medium",
      "mistral/magistral-small",
      "mistral/ministral-3b",
      "mistral/ministral-8b",
      "mistral/mistral-large",
      "mistral/mistral-small",
      "mistral/mixtral-8x22b-instruct",
      "mistral/pixtral-12b",
      "mistral/pixtral-large",
      "moonshotai/kimi-k2",
      "morph/morph-v3-fast",
      "morph/morph-v3-large",
      "openai/gpt-4-turbo",
      "openai/gpt-4.1",
      "openai/gpt-4.1-mini",
      "openai/gpt-4.1-nano",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "openai/gpt-5",
      "openai/gpt-5-mini",
      "openai/gpt-5-nano",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "openai/o1",
      "openai/o3",
      "openai/o3-mini",
      "openai/o4-mini",
      "vercel/v0-1.0-md",
      "vercel/v0-1.5-md",
      "xai/grok-2",
      "xai/grok-2-vision",
      "xai/grok-3",
      "xai/grok-3-fast",
      "xai/grok-3-mini",
      "xai/grok-3-mini-fast",
      "xai/grok-4"
    ]
  },
  "google": {
    "url": "https://generativelanguage.googleapis.com/v1beta/chat/completions",
    "apiKeyEnvVar": "GOOGLE_GENERATIVE_AI_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Google",
    "models": [
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite-preview-06-17",
      "gemini-2.5-flash-preview-04-17",
      "gemini-2.5-flash-preview-05-20",
      "gemini-2.5-pro",
      "gemini-2.5-pro-preview-05-06",
      "gemini-2.5-pro-preview-06-05"
    ]
  },
  "togetherai": {
    "url": "https://api.together.xyz/v1/chat/completions",
    "apiKeyEnvVar": "TOGETHER_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Together AI",
    "models": [
      "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",
      "deepseek-ai/DeepSeek-R1",
      "deepseek-ai/DeepSeek-V3",
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "moonshotai/Kimi-K2-Instruct",
      "openai/gpt-oss-120b"
    ]
  },
  "wandb": {
    "url": "https://api.inference.wandb.ai/v1/chat/completions",
    "apiKeyEnvVar": "WANDB_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Weights & Biases",
    "models": [
      "Qwen/Qwen3-235B-A22B-Instruct-2507",
      "Qwen/Qwen3-235B-A22B-Thinking-2507",
      "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      "deepseek-ai/DeepSeek-R1-0528",
      "deepseek-ai/DeepSeek-V3-0324",
      "meta-llama/Llama-3.1-8B-Instruct",
      "meta-llama/Llama-3.3-70B-Instruct",
      "meta-llama/Llama-4-Scout-17B-16E-Instruct",
      "microsoft/Phi-4-mini-instruct",
      "moonshotai/Kimi-K2-Instruct"
    ]
  },
  "inference": {
    "url": "https://inference.net/v1/chat/completions",
    "apiKeyEnvVar": "INFERENCE_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Inference",
    "models": [
      "google/gemma-3",
      "meta/llama-3.1-8b-instruct",
      "meta/llama-3.2-11b-vision-instruct",
      "meta/llama-3.2-1b-instruct",
      "meta/llama-3.2-3b-instruct",
      "mistral/mistral-nemo-12b-instruct",
      "osmosis/osmosis-structure-0.6b",
      "qwen/qwen-2.5-7b-vision-instruct",
      "qwen/qwen3-embedding-4b"
    ]
  },
  "github_models": {
    "url": "https://models.github.ai/inference/chat/completions",
    "apiKeyEnvVar": "GITHUB_TOKEN",
    "apiKeyHeader": "Authorization",
    "name": "GitHub Models",
    "models": [
      "ai21-labs/ai21-jamba-1.5-large",
      "ai21-labs/ai21-jamba-1.5-mini",
      "cohere/cohere-command-a",
      "cohere/cohere-command-r",
      "cohere/cohere-command-r-08-2024",
      "cohere/cohere-command-r-plus",
      "cohere/cohere-command-r-plus-08-2024",
      "core42/jais-30b-chat",
      "deepseek/deepseek-r1",
      "deepseek/deepseek-r1-0528",
      "deepseek/deepseek-v3-0324",
      "meta/llama-3.2-11b-vision-instruct",
      "meta/llama-3.2-90b-vision-instruct",
      "meta/llama-3.3-70b-instruct",
      "meta/llama-4-maverick-17b-128e-instruct-fp8",
      "meta/llama-4-scout-17b-16e-instruct",
      "meta/meta-llama-3-70b-instruct",
      "meta/meta-llama-3-8b-instruct",
      "meta/meta-llama-3.1-405b-instruct",
      "meta/meta-llama-3.1-70b-instruct",
      "meta/meta-llama-3.1-8b-instruct",
      "microsoft/mai-ds-r1",
      "microsoft/phi-3-medium-128k-instruct",
      "microsoft/phi-3-medium-4k-instruct",
      "microsoft/phi-3-mini-128k-instruct",
      "microsoft/phi-3-mini-4k-instruct",
      "microsoft/phi-3-small-128k-instruct",
      "microsoft/phi-3-small-8k-instruct",
      "microsoft/phi-3.5-mini-instruct",
      "microsoft/phi-3.5-moe-instruct",
      "microsoft/phi-3.5-vision-instruct",
      "microsoft/phi-4",
      "microsoft/phi-4-mini-instruct",
      "microsoft/phi-4-mini-reasoning",
      "microsoft/phi-4-multimodal-instruct",
      "microsoft/phi-4-reasoning",
      "mistral-ai/codestral-2501",
      "mistral-ai/ministral-3b",
      "mistral-ai/mistral-large-2411",
      "mistral-ai/mistral-medium-2505",
      "mistral-ai/mistral-nemo",
      "mistral-ai/mistral-small-2503",
      "openai/gpt-4.1",
      "openai/gpt-4.1-mini",
      "openai/gpt-4.1-nano",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "openai/o1",
      "openai/o1-mini",
      "openai/o1-preview",
      "openai/o3",
      "openai/o3-mini",
      "openai/o4-mini",
      "xai/grok-3",
      "xai/grok-3-mini"
    ]
  },
  "opencode": {
    "url": "https://opencode.ai/zen/v1/chat/completions",
    "apiKeyEnvVar": "OPENCODE_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "opencode",
    "models": [
      "claude-3-5-haiku",
      "claude-opus-4-1",
      "claude-sonnet-4",
      "gpt-5",
      "grok-code",
      "kimi-k2",
      "qwen3-coder"
    ]
  },
  "nvidia": {
    "url": "https://integrate.api.nvidia.com/v1/chat/completions",
    "apiKeyEnvVar": "NVIDIA_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Nvidia",
    "models": [
      "cosmos-nemotron-34b",
      "deepseek-r1",
      "deepseek-v3.1",
      "flux_1-dev",
      "gemma-3-27b-it",
      "llama-3.1-nemotron-ultra-253b-v1",
      "llama-3.3-nemotron-super-49b-v1.5",
      "mistral-small-3.1-24b-instruct-2503",
      "nemoretriever-ocr-v1",
      "parakeet-tdt-0.6b-v2",
      "phi-4-multimodal-instruct",
      "qwen3-235b-a22b",
      "qwen3-coder-480b-a35b-instruct",
      "whisper-large-v3"
    ]
  },
  "huggingface": {
    "url": "https://router.huggingface.co/v1/chat/completions",
    "apiKeyEnvVar": "HF_TOKEN",
    "apiKeyHeader": "Authorization",
    "name": "Hugging Face",
    "models": [
      "Qwen/Qwen3-235B-A22B-Thinking-2507",
      "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      "deepseek-ai/DeepSeek-R1-0528",
      "deepseek-ai/Deepseek-V3-0324",
      "moonshotai/Kimi-K2-Instruct",
      "zai-org/GLM-4.5",
      "zai-org/GLM-4.5-Air"
    ]
  },
  "inception": {
    "url": "https://api.inceptionlabs.ai/v1/chat/completions",
    "apiKeyEnvVar": "INCEPTION_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Inception",
    "models": [
      "mercury",
      "mercury-coder"
    ]
  },
  "groq": {
    "url": "https://api.groq.com/openai/v1/chat/completions",
    "apiKeyEnvVar": "GROQ_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Groq",
    "models": [
      "deepseek-r1-distill-llama-70b",
      "gemma2-9b-it",
      "llama-3.1-8b-instant",
      "llama-3.3-70b-versatile",
      "llama-guard-3-8b",
      "llama3-70b-8192",
      "llama3-8b-8192",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "meta-llama/llama-guard-4-12b",
      "mistral-saba-24b",
      "moonshotai/kimi-k2-instruct",
      "moonshotai/kimi-k2-instruct-0905",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen-qwq-32b",
      "qwen/qwen3-32b"
    ]
  },
  "chutes": {
    "url": "https://llm.chutes.ai/v1/chat/completions",
    "apiKeyEnvVar": "CHUTES_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Chutes",
    "models": [
      "Qwen/Qwen3-235B-A22B-Instruct-2507",
      "Qwen/Qwen3-235B-A22B-Thinking-2507",
      "Qwen/Qwen3-30B-A3B",
      "Qwen/Qwen3-30B-A3B-Instruct-2507",
      "Qwen/Qwen3-Coder-30B-A3B-Instruct",
      "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",
      "chutesai/Devstral-Small-2505",
      "chutesai/Mistral-Small-3.2-24B-Instruct-2506",
      "deepseek-ai/DeepSeek-R1-0528",
      "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B",
      "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
      "deepseek-ai/DeepSeek-V3-0324",
      "deepseek-ai/DeepSeek-V3.1",
      "deepseek-ai/DeepSeek-V3.1:THINKING",
      "moonshotai/Kimi-Dev-72B",
      "moonshotai/Kimi-K2-Instruct-0905",
      "moonshotai/Kimi-K2-Instruct-75k",
      "moonshotai/Kimi-VL-A3B-Thinking",
      "openai/gpt-oss-120b",
      "tngtech/DeepSeek-R1T-Chimera",
      "tngtech/DeepSeek-TNG-R1T2-Chimera",
      "zai-org/GLM-4.5-Air",
      "zai-org/GLM-4.5-FP8"
    ]
  },
  "lmstudio": {
    "url": "http://127.0.0.1:1234/v1/chat/completions",
    "apiKeyEnvVar": "LMSTUDIO_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "LMStudio",
    "models": [
      "openai/gpt-oss-20b",
      "qwen/qwen3-30b-a3b-2507",
      "qwen/qwen3-coder-30b"
    ]
  },
  "zai": {
    "url": "https://api.z.ai/api/paas/v4/chat/completions",
    "apiKeyEnvVar": "ZHIPU_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Z.AI",
    "models": [
      "glm-4.5",
      "glm-4.5-air",
      "glm-4.5-flash",
      "glm-4.5v"
    ]
  },
  "fastrouter": {
    "url": "https://go.fastrouter.ai/api/v1/chat/completions",
    "apiKeyEnvVar": "FASTROUTER_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "FastRouter",
    "models": [
      "anthropic/claude-opus-4.1",
      "anthropic/claude-sonnet-4",
      "deepseek-ai/deepseek-r1-distill-llama-70b",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-pro",
      "moonshotai/kimi-k2",
      "openai/gpt-4.1",
      "openai/gpt-5",
      "openai/gpt-5-mini",
      "openai/gpt-5-nano",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3-coder",
      "x-ai/grok-4"
    ]
  },
  "morph": {
    "url": "https://api.morphllm.com/v1/chat/completions",
    "apiKeyEnvVar": "MORPH_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Morph",
    "models": [
      "auto",
      "morph-v3-fast",
      "morph-v3-large"
    ]
  },
  "moonshotai": {
    "url": "https://api.moonshot.ai/v1/chat/completions",
    "apiKeyEnvVar": "MOONSHOT_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Moonshot AI",
    "models": [
      "kimi-k2-0711-preview",
      "kimi-k2-0905-preview",
      "kimi-k2-turbo-preview"
    ]
  },
  "netlify": {
    "url": "https://api.netlify.com/api/v1/ai-gateway",
    "apiKeyEnvVar": "NETLIFY_API_KEY",
    "apiKeyHeader": "Authorization",
    "name": "Netlify AI Gateway",
    "models": [
      "anthropic/claude-3-5-haiku-20241022",
      "anthropic/claude-3-7-sonnet-20250219",
      "anthropic/claude-3-haiku-20240307",
      "anthropic/claude-opus-4-20250514",
      "anthropic/claude-sonnet-4-20250514",
      "gemini/gemini-1.5-flash",
      "gemini/gemini-1.5-flash-8b",
      "gemini/gemini-1.5-pro",
      "gemini/gemini-2.0-flash",
      "gemini/gemini-2.0-flash-lite",
      "gemini/gemini-2.5-flash",
      "gemini/gemini-2.5-flash-lite",
      "gemini/gemini-2.5-pro",
      "gemini/imagen-4.0-generate-001",
      "gemini/veo-3.0-generate-preview",
      "openai/codex-mini-latest",
      "openai/dall-e-2",
      "openai/dall-e-3",
      "openai/gpt-3.5-turbo",
      "openai/gpt-4-turbo",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "openai/gpt-image-1",
      "openai/o1",
      "openai/o1-mini",
      "openai/o3-mini"
    ]
  }
} as const;

/**
 * Available models per provider
 */
export const PROVIDER_MODELS = {
  "deepseek": [
    "deepseek-chat",
    "deepseek-reasoner"
  ],
  "xai": [
    "grok-2",
    "grok-2-1212",
    "grok-2-latest",
    "grok-2-vision",
    "grok-2-vision-1212",
    "grok-2-vision-latest",
    "grok-3",
    "grok-3-fast",
    "grok-3-fast-latest",
    "grok-3-latest",
    "grok-3-mini",
    "grok-3-mini-fast",
    "grok-3-mini-fast-latest",
    "grok-3-mini-latest",
    "grok-4",
    "grok-beta",
    "grok-vision-beta"
  ],
  "fireworks_ai": [
    "accounts/fireworks/gpt-oss-120b",
    "accounts/fireworks/gpt-oss-20b",
    "accounts/fireworks/models/deepseek-r1-0528",
    "accounts/fireworks/models/deepseek-v3-0324",
    "accounts/fireworks/models/deepseek-v3p1",
    "accounts/fireworks/models/glm-4p5",
    "accounts/fireworks/models/glm-4p5-air",
    "accounts/fireworks/models/kimi-k2-instruct",
    "accounts/fireworks/models/qwen3-235b-a22b",
    "accounts/fireworks/models/qwen3-coder-480b-a35b-instruct"
  ],
  "openrouter": [
    "anthropic/claude-3.5-haiku",
    "anthropic/claude-3.7-sonnet",
    "anthropic/claude-opus-4",
    "anthropic/claude-opus-4.1",
    "anthropic/claude-sonnet-4",
    "cognitivecomputations/dolphin3.0-mistral-24b",
    "cognitivecomputations/dolphin3.0-r1-mistral-24b",
    "deepseek/deepseek-chat-v3-0324",
    "deepseek/deepseek-chat-v3.1",
    "deepseek/deepseek-r1-0528-qwen3-8b:free",
    "deepseek/deepseek-r1-0528:free",
    "deepseek/deepseek-r1-distill-llama-70b",
    "deepseek/deepseek-r1-distill-qwen-14b",
    "deepseek/deepseek-r1:free",
    "deepseek/deepseek-v3-base:free",
    "featherless/qwerky-72b",
    "google/gemini-2.0-flash-001",
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-pro-preview-05-06",
    "google/gemini-2.5-pro-preview-06-05",
    "google/gemma-2-9b-it:free",
    "google/gemma-3-12b-it",
    "google/gemma-3-27b-it",
    "google/gemma-3n-e4b-it",
    "google/gemma-3n-e4b-it:free",
    "meta-llama/llama-3.2-11b-vision-instruct",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-4-scout:free",
    "microsoft/mai-ds-r1:free",
    "mistralai/codestral-2508",
    "mistralai/devstral-medium-2507",
    "mistralai/devstral-small-2505",
    "mistralai/devstral-small-2505:free",
    "mistralai/devstral-small-2507",
    "mistralai/mistral-7b-instruct:free",
    "mistralai/mistral-medium-3",
    "mistralai/mistral-medium-3.1",
    "mistralai/mistral-nemo:free",
    "mistralai/mistral-small-3.1-24b-instruct",
    "mistralai/mistral-small-3.2-24b-instruct",
    "mistralai/mistral-small-3.2-24b-instruct:free",
    "moonshotai/kimi-dev-72b:free",
    "moonshotai/kimi-k2",
    "moonshotai/kimi-k2-0905",
    "moonshotai/kimi-k2:free",
    "nousresearch/deephermes-3-llama-3-8b-preview",
    "nousresearch/hermes-4-405b",
    "nousresearch/hermes-4-70b",
    "openai/gpt-4.1",
    "openai/gpt-4.1-mini",
    "openai/gpt-4o-mini",
    "openai/gpt-5",
    "openai/gpt-5-chat",
    "openai/gpt-5-mini",
    "openai/gpt-5-nano",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "openai/o4-mini",
    "openrouter/cypher-alpha:free",
    "openrouter/horizon-alpha",
    "openrouter/horizon-beta",
    "openrouter/sonoma-dusk-alpha",
    "openrouter/sonoma-sky-alpha",
    "qwen/qwen-2.5-coder-32b-instruct",
    "qwen/qwen2.5-vl-32b-instruct:free",
    "qwen/qwen2.5-vl-72b-instruct",
    "qwen/qwen2.5-vl-72b-instruct:free",
    "qwen/qwen3-14b:free",
    "qwen/qwen3-235b-a22b-07-25",
    "qwen/qwen3-235b-a22b-07-25:free",
    "qwen/qwen3-235b-a22b-thinking-2507",
    "qwen/qwen3-235b-a22b:free",
    "qwen/qwen3-30b-a3b-instruct-2507",
    "qwen/qwen3-30b-a3b:free",
    "qwen/qwen3-32b:free",
    "qwen/qwen3-8b:free",
    "qwen/qwen3-coder",
    "qwen/qwen3-coder:free",
    "qwen/qwen3-max",
    "qwen/qwq-32b:free",
    "rekaai/reka-flash-3",
    "sarvamai/sarvam-m:free",
    "thudm/glm-z1-32b:free",
    "tngtech/deepseek-r1t2-chimera:free",
    "x-ai/grok-3",
    "x-ai/grok-3-beta",
    "x-ai/grok-3-mini",
    "x-ai/grok-3-mini-beta",
    "x-ai/grok-4",
    "x-ai/grok-code-fast-1",
    "z-ai/glm-4.5",
    "z-ai/glm-4.5-air",
    "z-ai/glm-4.5-air:free",
    "z-ai/glm-4.5v"
  ],
  "cerebras": [
    "gpt-oss-120b",
    "qwen-3-235b-a22b-instruct-2507",
    "qwen-3-coder-480b"
  ],
  "venice": [
    "deepseek-coder-v2-lite",
    "deepseek-r1-671b",
    "dolphin-2.9.2-qwen2-72b",
    "llama-3.1-405b",
    "llama-3.2-3b",
    "llama-3.3-70b",
    "mistral-31-24b",
    "qwen-2.5-coder-32b",
    "qwen-2.5-qwq-32b",
    "qwen-2.5-vl",
    "qwen3-235b",
    "qwen3-4b",
    "venice-uncensored"
  ],
  "github_copilot": [
    "claude-3.5-sonnet",
    "claude-3.7-sonnet",
    "claude-3.7-sonnet-thought",
    "claude-opus-4",
    "claude-opus-41",
    "claude-sonnet-4",
    "gemini-2.0-flash-001",
    "gemini-2.5-pro",
    "gpt-4.1",
    "gpt-4o",
    "gpt-5",
    "gpt-5-mini",
    "grok-code-fast-1",
    "o3",
    "o3-mini",
    "o4-mini"
  ],
  "submodel": [
    "Qwen/Qwen3-235B-A22B-Instruct-2507",
    "Qwen/Qwen3-235B-A22B-Thinking-2507",
    "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",
    "deepseek-ai/DeepSeek-R1-0528",
    "deepseek-ai/DeepSeek-V3-0324",
    "deepseek-ai/DeepSeek-V3.1",
    "openai/gpt-oss-120b",
    "zai-org/GLM-4.5-Air",
    "zai-org/GLM-4.5-FP8"
  ],
  "anthropic": [
    "claude-3-5-haiku-20241022",
    "claude-3-5-sonnet-20240620",
    "claude-3-5-sonnet-20241022",
    "claude-3-7-sonnet-20250219",
    "claude-3-haiku-20240307",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-opus-4-1-20250805",
    "claude-opus-4-20250514",
    "claude-sonnet-4-20250514"
  ],
  "alibaba": [
    "qwen3-coder-plus"
  ],
  "openai": [
    "codex-mini-latest",
    "gpt-3.5-turbo",
    "gpt-4",
    "gpt-4-turbo",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-5",
    "gpt-5-chat-latest",
    "gpt-5-mini",
    "gpt-5-nano",
    "o1",
    "o1-mini",
    "o1-preview",
    "o1-pro",
    "o3",
    "o3-deep-research",
    "o3-mini",
    "o3-pro",
    "o4-mini",
    "o4-mini-deep-research"
  ],
  "mistral": [
    "codestral-latest",
    "devstral-medium-2507",
    "devstral-small-2505",
    "devstral-small-2507",
    "magistral-medium-latest",
    "magistral-small",
    "ministral-3b-latest",
    "ministral-8b-latest",
    "mistral-large-latest",
    "mistral-medium-2505",
    "mistral-medium-2508",
    "mistral-medium-latest",
    "mistral-nemo",
    "mistral-small-latest",
    "open-mistral-7b",
    "open-mixtral-8x22b",
    "open-mixtral-8x7b",
    "pixtral-12b",
    "pixtral-large-latest"
  ],
  "upstage": [
    "solar-mini",
    "solar-pro2"
  ],
  "llama": [
    "cerebras-llama-4-maverick-17b-128e-instruct",
    "cerebras-llama-4-scout-17b-16e-instruct",
    "groq-llama-4-maverick-17b-128e-instruct",
    "llama-3.3-70b-instruct",
    "llama-3.3-8b-instruct",
    "llama-4-maverick-17b-128e-instruct-fp8",
    "llama-4-scout-17b-16e-instruct-fp8"
  ],
  "moonshotai_cn": [
    "kimi-k2-0711-preview",
    "kimi-k2-0905-preview",
    "kimi-k2-turbo-preview"
  ],
  "deepinfra": [
    "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    "Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo",
    "moonshotai/Kimi-K2-Instruct",
    "zai-org/GLM-4.5"
  ],
  "zhipuai": [
    "glm-4.5",
    "glm-4.5-air",
    "glm-4.5-flash",
    "glm-4.5v"
  ],
  "synthetic": [
    "hf:Qwen/Qwen2.5-Coder-32B-Instruct",
    "hf:Qwen/Qwen3-235B-A22B-Instruct-2507",
    "hf:Qwen/Qwen3-235B-A22B-Thinking-2507",
    "hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
    "hf:deepseek-ai/DeepSeek-R1",
    "hf:deepseek-ai/DeepSeek-R1-0528",
    "hf:deepseek-ai/DeepSeek-V3",
    "hf:deepseek-ai/DeepSeek-V3-0324",
    "hf:deepseek-ai/DeepSeek-V3.1",
    "hf:meta-llama/Llama-3.1-405B-Instruct",
    "hf:meta-llama/Llama-3.1-70B-Instruct",
    "hf:meta-llama/Llama-3.1-8B-Instruct",
    "hf:meta-llama/Llama-3.3-70B-Instruct",
    "hf:meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    "hf:meta-llama/Llama-4-Scout-17B-16E-Instruct",
    "hf:moonshotai/Kimi-K2-Instruct",
    "hf:moonshotai/Kimi-K2-Instruct-0905",
    "hf:openai/gpt-oss-120b",
    "hf:zai-org/GLM-4.5"
  ],
  "modelscope": [
    "Qwen/Qwen3-235B-A22B-Instruct-2507",
    "Qwen/Qwen3-235B-A22B-Thinking-2507",
    "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "Qwen/Qwen3-30B-A3B-Thinking-2507",
    "Qwen/Qwen3-Coder-30B-A3B-Instruct",
    "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    "ZhipuAI/GLM-4.5",
    "moonshotai/Kimi-K2-Instruct"
  ],
  "baseten": [
    "Moonshotai-Kimi-K2-Instruct-0905",
    "Qwen-Qwen3-Coder-480B-A35B-Instruct"
  ],
  "vercel": [
    "amazon/nova-lite",
    "amazon/nova-micro",
    "amazon/nova-pro",
    "anthropic/claude-3-5-haiku",
    "anthropic/claude-3-haiku",
    "anthropic/claude-3-opus",
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3.7-sonnet",
    "anthropic/claude-4-1-opus",
    "anthropic/claude-4-opus",
    "anthropic/claude-4-sonnet",
    "cerebras/qwen3-coder",
    "deepseek/deepseek-r1",
    "deepseek/deepseek-r1-distill-llama-70b",
    "google/gemini-2.0-flash",
    "google/gemini-2.0-flash-lite",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-pro",
    "meta/llama-3.3-70b",
    "meta/llama-4-maverick",
    "meta/llama-4-scout",
    "mistral/codestral",
    "mistral/magistral-medium",
    "mistral/magistral-small",
    "mistral/ministral-3b",
    "mistral/ministral-8b",
    "mistral/mistral-large",
    "mistral/mistral-small",
    "mistral/mixtral-8x22b-instruct",
    "mistral/pixtral-12b",
    "mistral/pixtral-large",
    "moonshotai/kimi-k2",
    "morph/morph-v3-fast",
    "morph/morph-v3-large",
    "openai/gpt-4-turbo",
    "openai/gpt-4.1",
    "openai/gpt-4.1-mini",
    "openai/gpt-4.1-nano",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/gpt-5",
    "openai/gpt-5-mini",
    "openai/gpt-5-nano",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "openai/o1",
    "openai/o3",
    "openai/o3-mini",
    "openai/o4-mini",
    "vercel/v0-1.0-md",
    "vercel/v0-1.5-md",
    "xai/grok-2",
    "xai/grok-2-vision",
    "xai/grok-3",
    "xai/grok-3-fast",
    "xai/grok-3-mini",
    "xai/grok-3-mini-fast",
    "xai/grok-4"
  ],
  "google": [
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite-preview-06-17",
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.5-flash-preview-05-20",
    "gemini-2.5-pro",
    "gemini-2.5-pro-preview-05-06",
    "gemini-2.5-pro-preview-06-05"
  ],
  "togetherai": [
    "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",
    "deepseek-ai/DeepSeek-R1",
    "deepseek-ai/DeepSeek-V3",
    "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "moonshotai/Kimi-K2-Instruct",
    "openai/gpt-oss-120b"
  ],
  "wandb": [
    "Qwen/Qwen3-235B-A22B-Instruct-2507",
    "Qwen/Qwen3-235B-A22B-Thinking-2507",
    "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    "deepseek-ai/DeepSeek-R1-0528",
    "deepseek-ai/DeepSeek-V3-0324",
    "meta-llama/Llama-3.1-8B-Instruct",
    "meta-llama/Llama-3.3-70B-Instruct",
    "meta-llama/Llama-4-Scout-17B-16E-Instruct",
    "microsoft/Phi-4-mini-instruct",
    "moonshotai/Kimi-K2-Instruct"
  ],
  "inference": [
    "google/gemma-3",
    "meta/llama-3.1-8b-instruct",
    "meta/llama-3.2-11b-vision-instruct",
    "meta/llama-3.2-1b-instruct",
    "meta/llama-3.2-3b-instruct",
    "mistral/mistral-nemo-12b-instruct",
    "osmosis/osmosis-structure-0.6b",
    "qwen/qwen-2.5-7b-vision-instruct",
    "qwen/qwen3-embedding-4b"
  ],
  "github_models": [
    "ai21-labs/ai21-jamba-1.5-large",
    "ai21-labs/ai21-jamba-1.5-mini",
    "cohere/cohere-command-a",
    "cohere/cohere-command-r",
    "cohere/cohere-command-r-08-2024",
    "cohere/cohere-command-r-plus",
    "cohere/cohere-command-r-plus-08-2024",
    "core42/jais-30b-chat",
    "deepseek/deepseek-r1",
    "deepseek/deepseek-r1-0528",
    "deepseek/deepseek-v3-0324",
    "meta/llama-3.2-11b-vision-instruct",
    "meta/llama-3.2-90b-vision-instruct",
    "meta/llama-3.3-70b-instruct",
    "meta/llama-4-maverick-17b-128e-instruct-fp8",
    "meta/llama-4-scout-17b-16e-instruct",
    "meta/meta-llama-3-70b-instruct",
    "meta/meta-llama-3-8b-instruct",
    "meta/meta-llama-3.1-405b-instruct",
    "meta/meta-llama-3.1-70b-instruct",
    "meta/meta-llama-3.1-8b-instruct",
    "microsoft/mai-ds-r1",
    "microsoft/phi-3-medium-128k-instruct",
    "microsoft/phi-3-medium-4k-instruct",
    "microsoft/phi-3-mini-128k-instruct",
    "microsoft/phi-3-mini-4k-instruct",
    "microsoft/phi-3-small-128k-instruct",
    "microsoft/phi-3-small-8k-instruct",
    "microsoft/phi-3.5-mini-instruct",
    "microsoft/phi-3.5-moe-instruct",
    "microsoft/phi-3.5-vision-instruct",
    "microsoft/phi-4",
    "microsoft/phi-4-mini-instruct",
    "microsoft/phi-4-mini-reasoning",
    "microsoft/phi-4-multimodal-instruct",
    "microsoft/phi-4-reasoning",
    "mistral-ai/codestral-2501",
    "mistral-ai/ministral-3b",
    "mistral-ai/mistral-large-2411",
    "mistral-ai/mistral-medium-2505",
    "mistral-ai/mistral-nemo",
    "mistral-ai/mistral-small-2503",
    "openai/gpt-4.1",
    "openai/gpt-4.1-mini",
    "openai/gpt-4.1-nano",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/o1",
    "openai/o1-mini",
    "openai/o1-preview",
    "openai/o3",
    "openai/o3-mini",
    "openai/o4-mini",
    "xai/grok-3",
    "xai/grok-3-mini"
  ],
  "opencode": [
    "claude-3-5-haiku",
    "claude-opus-4-1",
    "claude-sonnet-4",
    "gpt-5",
    "grok-code",
    "kimi-k2",
    "qwen3-coder"
  ],
  "nvidia": [
    "cosmos-nemotron-34b",
    "deepseek-r1",
    "deepseek-v3.1",
    "flux_1-dev",
    "gemma-3-27b-it",
    "llama-3.1-nemotron-ultra-253b-v1",
    "llama-3.3-nemotron-super-49b-v1.5",
    "mistral-small-3.1-24b-instruct-2503",
    "nemoretriever-ocr-v1",
    "parakeet-tdt-0.6b-v2",
    "phi-4-multimodal-instruct",
    "qwen3-235b-a22b",
    "qwen3-coder-480b-a35b-instruct",
    "whisper-large-v3"
  ],
  "huggingface": [
    "Qwen/Qwen3-235B-A22B-Thinking-2507",
    "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    "deepseek-ai/DeepSeek-R1-0528",
    "deepseek-ai/Deepseek-V3-0324",
    "moonshotai/Kimi-K2-Instruct",
    "zai-org/GLM-4.5",
    "zai-org/GLM-4.5-Air"
  ],
  "inception": [
    "mercury",
    "mercury-coder"
  ],
  "groq": [
    "deepseek-r1-distill-llama-70b",
    "gemma2-9b-it",
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "llama-guard-3-8b",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-guard-4-12b",
    "mistral-saba-24b",
    "moonshotai/kimi-k2-instruct",
    "moonshotai/kimi-k2-instruct-0905",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen-qwq-32b",
    "qwen/qwen3-32b"
  ],
  "chutes": [
    "Qwen/Qwen3-235B-A22B-Instruct-2507",
    "Qwen/Qwen3-235B-A22B-Thinking-2507",
    "Qwen/Qwen3-30B-A3B",
    "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "Qwen/Qwen3-Coder-30B-A3B-Instruct",
    "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",
    "chutesai/Devstral-Small-2505",
    "chutesai/Mistral-Small-3.2-24B-Instruct-2506",
    "deepseek-ai/DeepSeek-R1-0528",
    "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B",
    "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
    "deepseek-ai/DeepSeek-V3-0324",
    "deepseek-ai/DeepSeek-V3.1",
    "deepseek-ai/DeepSeek-V3.1:THINKING",
    "moonshotai/Kimi-Dev-72B",
    "moonshotai/Kimi-K2-Instruct-0905",
    "moonshotai/Kimi-K2-Instruct-75k",
    "moonshotai/Kimi-VL-A3B-Thinking",
    "openai/gpt-oss-120b",
    "tngtech/DeepSeek-R1T-Chimera",
    "tngtech/DeepSeek-TNG-R1T2-Chimera",
    "zai-org/GLM-4.5-Air",
    "zai-org/GLM-4.5-FP8"
  ],
  "lmstudio": [
    "openai/gpt-oss-20b",
    "qwen/qwen3-30b-a3b-2507",
    "qwen/qwen3-coder-30b"
  ],
  "zai": [
    "glm-4.5",
    "glm-4.5-air",
    "glm-4.5-flash",
    "glm-4.5v"
  ],
  "fastrouter": [
    "anthropic/claude-opus-4.1",
    "anthropic/claude-sonnet-4",
    "deepseek-ai/deepseek-r1-distill-llama-70b",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-pro",
    "moonshotai/kimi-k2",
    "openai/gpt-4.1",
    "openai/gpt-5",
    "openai/gpt-5-mini",
    "openai/gpt-5-nano",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3-coder",
    "x-ai/grok-4"
  ],
  "morph": [
    "auto",
    "morph-v3-fast",
    "morph-v3-large"
  ],
  "moonshotai": [
    "kimi-k2-0711-preview",
    "kimi-k2-0905-preview",
    "kimi-k2-turbo-preview"
  ],
  "netlify": [
    "anthropic/claude-3-5-haiku-20241022",
    "anthropic/claude-3-7-sonnet-20250219",
    "anthropic/claude-3-haiku-20240307",
    "anthropic/claude-opus-4-20250514",
    "anthropic/claude-sonnet-4-20250514",
    "gemini/gemini-1.5-flash",
    "gemini/gemini-1.5-flash-8b",
    "gemini/gemini-1.5-pro",
    "gemini/gemini-2.0-flash",
    "gemini/gemini-2.0-flash-lite",
    "gemini/gemini-2.5-flash",
    "gemini/gemini-2.5-flash-lite",
    "gemini/gemini-2.5-pro",
    "gemini/imagen-4.0-generate-001",
    "gemini/veo-3.0-generate-preview",
    "openai/codex-mini-latest",
    "openai/dall-e-2",
    "openai/dall-e-3",
    "openai/gpt-3.5-turbo",
    "openai/gpt-4-turbo",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/gpt-image-1",
    "openai/o1",
    "openai/o1-mini",
    "openai/o3-mini"
  ]
} as const;

/**
 * Type definitions for autocomplete support
 */
export type ProviderModels = typeof PROVIDER_MODELS;
export type Provider = keyof ProviderModels;
export type ModelForProvider<P extends Provider> = ProviderModels[P][number];

/**
 * OpenAI-compatible model ID type
 * Full provider/model paths (e.g., "openai/gpt-4o", "anthropic/claude-3-5-sonnet-20241022")
 */
export type OpenAICompatibleModelId = {[P in Provider]: `${P}/${ModelForProvider<P>}`}[Provider];


/**
 * Get provider configuration by provider ID
 */
export function getProviderConfig(providerId: string): ProviderConfig | undefined {
  return PROVIDER_REGISTRY[providerId as keyof typeof PROVIDER_REGISTRY];
}

/**
 * Check if a provider is registered
 */
export function isProviderRegistered(providerId: string): boolean {
  return providerId in PROVIDER_REGISTRY;
}

/**
 * Get all registered provider IDs
 */
export function getRegisteredProviders(): string[] {
  return Object.keys(PROVIDER_REGISTRY);
}

/**
 * Provider configuration interface
 */
export interface ProviderConfig {
  url: string;
  apiKeyEnvVar: string;
  apiKeyHeader?: string;
  name: string;
  models: readonly string[];
}

/**
 * Parse a model string to extract provider and model ID
 * Examples:
 *   "openai/gpt-4o" -> { provider: "openai", modelId: "gpt-4o" }
 *   "netlify/openai/gpt-4o" -> { provider: "netlify/openai", modelId: "gpt-4o" }
 *   "gpt-4o" -> { provider: null, modelId: "gpt-4o" }
 */
export function parseModelString(modelString: string): { provider: string | null; modelId: string } {
  const firstSlashIndex = modelString.indexOf('/');
  
  if (firstSlashIndex !== -1) {
    // Has at least one slash - extract everything before last slash as provider
    const lastSlashIndex = modelString.lastIndexOf('/');
    const provider = modelString.substring(0, lastSlashIndex);
    const modelId = modelString.substring(lastSlashIndex + 1);
    
    if (provider && modelId) {
      return {
        provider,
        modelId,
      };
    }
  }
  
  // No slash or invalid format
  return {
    provider: null,
    modelId: modelString,
  };
}

/**
 * Type guard to check if a string is a valid OpenAI-compatible model ID
 */
export function isValidModelId(modelId: string): modelId is OpenAICompatibleModelId {
  const { provider } = parseModelString(modelId);
  return provider !== null && isProviderRegistered(provider);
}
