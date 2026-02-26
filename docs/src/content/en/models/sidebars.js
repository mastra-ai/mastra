/**
 * Sidebar for Models
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  modelsSidebar: [
    'index',
    'embeddings',
    {
      type: 'category',
      label: 'Gateways',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'gateways/index',
          label: 'Gateways',
        },
        {
          type: 'doc',
          id: 'gateways/custom-gateways',
          label: 'Custom Gateways',
        },
        {
          type: 'doc',
          id: 'gateways/azure-openai',
          label: 'Azure-openai',
        },
        {
          type: 'doc',
          id: 'gateways/netlify',
          label: 'Netlify',
        },
        {
          type: 'doc',
          id: 'gateways/openrouter',
          label: 'OpenRouter',
        },
        {
          type: 'doc',
          id: 'gateways/vercel',
          label: 'Vercel',
        },
      ],
    },
    {
      type: 'category',
      label: 'Providers',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'providers/index',
          label: 'Providers',
        },
        {
          type: 'doc',
          id: 'providers/openai',
          label: 'OpenAI',
        },
        {
          type: 'doc',
          id: 'providers/anthropic',
          label: 'Anthropic',
        },
        {
          type: 'doc',
          id: 'providers/google',
          label: 'Google',
        },
        {
          type: 'doc',
          id: 'providers/deepseek',
          label: 'DeepSeek',
        },
        {
          type: 'doc',
          id: 'providers/groq',
          label: 'Groq',
        },
        {
          type: 'doc',
          id: 'providers/mistral',
          label: 'Mistral',
        },
        {
          type: 'doc',
          id: 'providers/xai',
          label: 'xAI',
        },
        {
          type: 'doc',
          id: 'providers/302ai',
          label: '302.AI',
        },
        {
          type: 'doc',
          id: 'providers/abacus',
          label: 'Abacus',
        },
        {
          type: 'doc',
          id: 'providers/aihubmix',
          label: 'AIHubMix',
        },
        {
          type: 'doc',
          id: 'providers/alibaba',
          label: 'Alibaba',
        },
        {
          type: 'doc',
          id: 'providers/alibaba-cn',
          label: 'Alibaba (China)',
        },
        {
          type: 'doc',
          id: 'providers/amazon-bedrock',
          label: 'Amazon Bedrock',
        },
        {
          type: 'doc',
          id: 'providers/azure',
          label: 'Azure',
        },
        {
          type: 'doc',
          id: 'providers/bailing',
          label: 'Bailing',
        },
        {
          type: 'doc',
          id: 'providers/baseten',
          label: 'Baseten',
        },
        {
          type: 'doc',
          id: 'providers/berget',
          label: 'Berget.AI',
        },
        {
          type: 'doc',
          id: 'providers/cerebras',
          label: 'Cerebras',
        },
        {
          type: 'doc',
          id: 'providers/chutes',
          label: 'Chutes',
        },
        {
          type: 'doc',
          id: 'providers/cloudferro-sherlock',
          label: 'CloudFerro Sherlock',
        },
        {
          type: 'doc',
          id: 'providers/cloudflare-ai-gateway',
          label: 'Cloudflare AI Gateway',
        },
        {
          type: 'doc',
          id: 'providers/cloudflare-workers-ai',
          label: 'Cloudflare Workers AI',
        },
        {
          type: 'doc',
          id: 'providers/cohere',
          label: 'Cohere',
        },
        {
          type: 'doc',
          id: 'providers/cortecs',
          label: 'Cortecs',
        },
        {
          type: 'doc',
          id: 'providers/deepinfra',
          label: 'Deep Infra',
        },
        {
          type: 'doc',
          id: 'providers/evroc',
          label: 'evroc',
        },
        {
          type: 'doc',
          id: 'providers/fastrouter',
          label: 'FastRouter',
        },
        {
          type: 'doc',
          id: 'providers/fireworks-ai',
          label: 'Fireworks AI',
        },
        {
          type: 'doc',
          id: 'providers/firmware',
          label: 'Firmware',
        },
        {
          type: 'doc',
          id: 'providers/friendli',
          label: 'Friendli',
        },
        {
          type: 'doc',
          id: 'providers/github-models',
          label: 'GitHub Models',
        },
        {
          type: 'doc',
          id: 'providers/google-vertex',
          label: 'Google Vertex AI',
        },
        {
          type: 'doc',
          id: 'providers/helicone',
          label: 'Helicone',
        },
        {
          type: 'doc',
          id: 'providers/huggingface',
          label: 'Hugging Face',
        },
        {
          type: 'doc',
          id: 'providers/iflowcn',
          label: 'iFlow',
        },
        {
          type: 'doc',
          id: 'providers/inception',
          label: 'Inception',
        },
        {
          type: 'doc',
          id: 'providers/inference',
          label: 'Inference',
        },
        {
          type: 'doc',
          id: 'providers/io-net',
          label: 'IO.NET',
        },
        {
          type: 'doc',
          id: 'providers/jiekou',
          label: 'Jiekou.AI',
        },
        {
          type: 'doc',
          id: 'providers/kilo',
          label: 'Kilo Gateway',
        },
        {
          type: 'doc',
          id: 'providers/kimi-for-coding',
          label: 'Kimi For Coding',
        },
        {
          type: 'doc',
          id: 'providers/kuae-cloud-coding-plan',
          label: 'KUAE Cloud Coding Plan',
        },
        {
          type: 'doc',
          id: 'providers/llama',
          label: 'Llama',
        },
        {
          type: 'doc',
          id: 'providers/lmstudio',
          label: 'LMStudio',
        },
        {
          type: 'doc',
          id: 'providers/lucidquery',
          label: 'LucidQuery AI',
        },
        {
          type: 'doc',
          id: 'providers/meganova',
          label: 'Meganova',
        },
        {
          type: 'doc',
          id: 'providers/minimax',
          label: 'MiniMax (minimax.io)',
        },
        {
          type: 'doc',
          id: 'providers/minimax-cn',
          label: 'MiniMax (minimaxi.com)',
        },
        {
          type: 'doc',
          id: 'providers/minimax-coding-plan',
          label: 'MiniMax Coding Plan (minimax.io)',
        },
        {
          type: 'doc',
          id: 'providers/minimax-cn-coding-plan',
          label: 'MiniMax Coding Plan (minimaxi.com)',
        },
        {
          type: 'doc',
          id: 'providers/moark',
          label: 'Moark',
        },
        {
          type: 'doc',
          id: 'providers/modelscope',
          label: 'ModelScope',
        },
        {
          type: 'doc',
          id: 'providers/moonshotai',
          label: 'Moonshot AI',
        },
        {
          type: 'doc',
          id: 'providers/moonshotai-cn',
          label: 'Moonshot AI (China)',
        },
        {
          type: 'doc',
          id: 'providers/morph',
          label: 'Morph',
        },
        {
          type: 'doc',
          id: 'providers/nano-gpt',
          label: 'NanoGPT',
        },
        {
          type: 'doc',
          id: 'providers/nebius',
          label: 'Nebius Token Factory',
        },
        {
          type: 'doc',
          id: 'providers/nova',
          label: 'Nova',
        },
        {
          type: 'doc',
          id: 'providers/novita-ai',
          label: 'NovitaAI',
        },
        {
          type: 'doc',
          id: 'providers/nvidia',
          label: 'Nvidia',
        },
        {
          type: 'doc',
          id: 'providers/ollama',
          label: 'Ollama',
        },
        {
          type: 'doc',
          id: 'providers/ollama-cloud',
          label: 'Ollama Cloud',
        },
        {
          type: 'doc',
          id: 'providers/opencode-go',
          label: 'OpenCode Go',
        },
        {
          type: 'doc',
          id: 'providers/opencode',
          label: 'OpenCode Zen',
        },
        {
          type: 'doc',
          id: 'providers/ovhcloud',
          label: 'OVHcloud AI Endpoints',
        },
        {
          type: 'doc',
          id: 'providers/perplexity',
          label: 'Perplexity',
        },
        {
          type: 'doc',
          id: 'providers/poe',
          label: 'Poe',
        },
        {
          type: 'doc',
          id: 'providers/privatemode-ai',
          label: 'Privatemode AI',
        },
        {
          type: 'doc',
          id: 'providers/qihang-ai',
          label: 'QiHang',
        },
        {
          type: 'doc',
          id: 'providers/qiniu-ai',
          label: 'Qiniu',
        },
        {
          type: 'doc',
          id: 'providers/requesty',
          label: 'Requesty',
        },
        {
          type: 'doc',
          id: 'providers/scaleway',
          label: 'Scaleway',
        },
        {
          type: 'doc',
          id: 'providers/siliconflow',
          label: 'SiliconFlow',
        },
        {
          type: 'doc',
          id: 'providers/siliconflow-cn',
          label: 'SiliconFlow (China)',
        },
        {
          type: 'doc',
          id: 'providers/stackit',
          label: 'STACKIT',
        },
        {
          type: 'doc',
          id: 'providers/stepfun',
          label: 'StepFun',
        },
        {
          type: 'doc',
          id: 'providers/submodel',
          label: 'submodel',
        },
        {
          type: 'doc',
          id: 'providers/synthetic',
          label: 'Synthetic',
        },
        {
          type: 'doc',
          id: 'providers/togetherai',
          label: 'Together AI',
        },
        {
          type: 'doc',
          id: 'providers/upstage',
          label: 'Upstage',
        },
        {
          type: 'doc',
          id: 'providers/vivgrid',
          label: 'Vivgrid',
        },
        {
          type: 'doc',
          id: 'providers/vultr',
          label: 'Vultr',
        },
        {
          type: 'doc',
          id: 'providers/wandb',
          label: 'Weights & Biases',
        },
        {
          type: 'doc',
          id: 'providers/xiaomi',
          label: 'Xiaomi',
        },
        {
          type: 'doc',
          id: 'providers/zai',
          label: 'Z.AI',
        },
        {
          type: 'doc',
          id: 'providers/zai-coding-plan',
          label: 'Z.AI Coding Plan',
        },
        {
          type: 'doc',
          id: 'providers/zenmux',
          label: 'ZenMux',
        },
        {
          type: 'doc',
          id: 'providers/zhipuai',
          label: 'Zhipu AI',
        },
        {
          type: 'doc',
          id: 'providers/zhipuai-coding-plan',
          label: 'Zhipu AI Coding Plan',
        },
      ],
    },
  ],
}

export default sidebars
