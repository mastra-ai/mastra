/**
 * Sidebar for Models
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  modelsSidebar: [
    "index",
    "embeddings",
    {
      type: "category",
      label: "Gateways",
      collapsed: false,
      items: [
        {
          type: "doc",
          id: "gateways/index",
          label: "Gateways",
        },
        {
          type: "doc",
          id: "gateways/custom-gateways",
          label: "Custom Gateways",
        },
        {
          type: "doc",
          id: "gateways/netlify",
          label: "Netlify",
        },
        {
          type: "doc",
          id: "gateways/openrouter",
          label: "OpenRouter",
        },
        {
          type: "doc",
          id: "gateways/vercel",
          label: "Vercel",
        },
      ],
    },
    {
      type: "category",
      label: "Providers",
      collapsed: false,
      items: [
        {
          type: "doc",
          id: "providers/index",
          label: "Providers",
        },
        {
          type: "doc",
          id: "providers/openai",
          label: "OpenAI",
        },
        {
          type: "doc",
          id: "providers/anthropic",
          label: "Anthropic",
        },
        {
          type: "doc",
          id: "providers/google",
          label: "Google",
        },
        {
          type: "doc",
          id: "providers/deepseek",
          label: "DeepSeek",
        },
        {
          type: "doc",
          id: "providers/groq",
          label: "Groq",
        },
        {
          type: "doc",
          id: "providers/mistral",
          label: "Mistral",
        },
        {
          type: "doc",
          id: "providers/xai",
          label: "xAI",
        },
        {
          type: "doc",
          id: "providers/aihubmix",
          label: "AIHubMix",
        },
        {
          type: "doc",
          id: "providers/alibaba",
          label: "Alibaba",
        },
        {
          type: "doc",
          id: "providers/alibaba-cn",
          label: "Alibaba (China)",
        },
        {
          type: "doc",
          id: "providers/amazon-bedrock",
          label: "Amazon Bedrock",
        },
        {
          type: "doc",
          id: "providers/azure",
          label: "Azure",
        },
        {
          type: "doc",
          id: "providers/baseten",
          label: "Baseten",
        },
        {
          type: "doc",
          id: "providers/cerebras",
          label: "Cerebras",
        },
        {
          type: "doc",
          id: "providers/chutes",
          label: "Chutes",
        },
        {
          type: "doc",
          id: "providers/cloudflare-workers-ai",
          label: "Cloudflare Workers AI",
        },
        {
          type: "doc",
          id: "providers/cortecs",
          label: "Cortecs",
        },
        {
          type: "doc",
          id: "providers/deepinfra",
          label: "Deep Infra",
        },
        {
          type: "doc",
          id: "providers/fastrouter",
          label: "FastRouter",
        },
        {
          type: "doc",
          id: "providers/fireworks-ai",
          label: "Fireworks AI",
        },
        {
          type: "doc",
          id: "providers/github-models",
          label: "GitHub Models",
        },
        {
          type: "doc",
          id: "providers/google-vertex",
          label: "Google Vertex AI",
        },
        {
          type: "doc",
          id: "providers/huggingface",
          label: "Hugging Face",
        },
        {
          type: "doc",
          id: "providers/iflowcn",
          label: "iFlow",
        },
        {
          type: "doc",
          id: "providers/inception",
          label: "Inception",
        },
        {
          type: "doc",
          id: "providers/inference",
          label: "Inference",
        },
        {
          type: "doc",
          id: "providers/llama",
          label: "Llama",
        },
        {
          type: "doc",
          id: "providers/lmstudio",
          label: "LMStudio",
        },
        {
          type: "doc",
          id: "providers/lucidquery",
          label: "LucidQuery AI",
        },
        {
          type: "doc",
          id: "providers/minimax",
          label: "Minimax",
        },
        {
          type: "doc",
          id: "providers/modelscope",
          label: "ModelScope",
        },
        {
          type: "doc",
          id: "providers/moonshotai",
          label: "Moonshot AI",
        },
        {
          type: "doc",
          id: "providers/moonshotai-cn",
          label: "Moonshot AI (China)",
        },
        {
          type: "doc",
          id: "providers/morph",
          label: "Morph",
        },
        {
          type: "doc",
          id: "providers/nebius",
          label: "Nebius Token Factory",
        },
        {
          type: "doc",
          id: "providers/nvidia",
          label: "Nvidia",
        },
        {
          type: "doc",
          id: "providers/ollama",
          label: "Ollama",
        },
        {
          type: "doc",
          id: "providers/opencode",
          label: "OpenCode Zen",
        },
        {
          type: "doc",
          id: "providers/ovhcloud",
          label: "OVHcloud AI Endpoints",
        },
        {
          type: "doc",
          id: "providers/perplexity",
          label: "Perplexity",
        },
        {
          type: "doc",
          id: "providers/requesty",
          label: "Requesty",
        },
        {
          type: "doc",
          id: "providers/scaleway",
          label: "Scaleway",
        },
        {
          type: "doc",
          id: "providers/submodel",
          label: "submodel",
        },
        {
          type: "doc",
          id: "providers/synthetic",
          label: "Synthetic",
        },
        {
          type: "doc",
          id: "providers/togetherai",
          label: "Together AI",
        },
        {
          type: "doc",
          id: "providers/upstage",
          label: "Upstage",
        },
        {
          type: "doc",
          id: "providers/venice",
          label: "Venice AI",
        },
        {
          type: "doc",
          id: "providers/vultr",
          label: "Vultr",
        },
        {
          type: "doc",
          id: "providers/wandb",
          label: "Weights & Biases",
        },
        {
          type: "doc",
          id: "providers/zai",
          label: "Z.AI",
        },
        {
          type: "doc",
          id: "providers/zai-coding-plan",
          label: "Z.AI Coding Plan",
        },
        {
          type: "doc",
          id: "providers/zenmux",
          label: "ZenMux",
        },
        {
          type: "doc",
          id: "providers/zhipuai",
          label: "Zhipu AI",
        },
        {
          type: "doc",
          id: "providers/zhipuai-coding-plan",
          label: "Zhipu AI Coding Plan",
        },
      ],
    },
  ],
};

export default sidebars;
