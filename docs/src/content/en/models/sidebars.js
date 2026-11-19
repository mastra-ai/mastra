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
      type: 'doc',
      id: 'environment-variables',
      label: 'Environment Variables',
    },
    {
      type: 'category',
      label: 'Gateways',
      collapsed: false,
      link: {
        type: 'doc',
        id: 'gateways/index',
      },
      items: [
        {
          type: 'doc',
          id: 'gateways/custom-gateways',
          label: 'Custom Gateways',
        },
        {
          type: 'doc',
          id: 'gateways/azure-openai',
          label: 'Azure OpenAI',
        },
        {
          type: 'doc',
          id: 'gateways/mastra',
          label: 'Mastra',
        },
        {
          type: 'doc',
          id: 'gateways/merge-gateway',
          label: 'Merge Gateway',
        },
        {
          type: 'doc',
          id: 'gateways/neon',
          label: 'Neon',
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
          id: 'gateways/requesty',
          label: 'Requesty',
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
      link: {
        type: 'doc',
        id: 'providers/index',
      },
      items: [
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
          id: 'providers/fiftyx',
          label: '50X',
        },
        {
          type: 'doc',
          id: 'providers/abacus',
          label: 'Abacus',
        },
        {
          type: 'doc',
          id: 'providers/abliteratedllm',
          label: 'AbliteratedLLM',
        },
        {
          type: 'doc',
          id: 'providers/abliteration-ai',
          label: 'abliteration.ai',
        },
        {
          type: 'doc',
          id: 'providers/above',
          label: 'above.dev',
        },
        {
          type: 'doc',
          id: 'providers/adaption',
          label: 'Adaption',
        },
        {
          type: 'doc',
          id: 'providers/adzuki',
          label: 'Adzuki AI',
        },
        {
          type: 'doc',
          id: 'providers/agentrouter',
          label: 'AgentRouter',
        },
        {
          type: 'doc',
          id: 'providers/agnes',
          label: 'Agnes AI',
        },
        {
          type: 'doc',
          id: 'providers/aipg',
          label: 'AI Power Grid',
        },
        {
          type: 'doc',
          id: 'providers/aistupidlevel',
          label: 'AI Stupid Level',
        },
        {
          type: 'doc',
          id: 'providers/ai-router',
          label: 'AI-ROUTER',
        },
        {
          type: 'doc',
          id: 'providers/aimlapi',
          label: 'AI/ML API',
        },
        {
          type: 'doc',
          id: 'providers/aiand',
          label: 'ai&',
        },
        {
          type: 'doc',
          id: 'providers/ai21',
          label: 'AI21 Labs',
        },
        {
          type: 'doc',
          id: 'providers/aigrow',
          label: 'AIGROW',
        },
        {
          type: 'doc',
          id: 'providers/aihubmix',
          label: 'AIHubMix',
        },
        {
          type: 'doc',
          id: 'providers/ainetcafe',
          label: 'ainetcafe',
        },
        {
          type: 'doc',
          id: 'providers/aixy',
          label: 'Aixy',
        },
        {
          type: 'doc',
          id: 'providers/aki-io',
          label: 'AKI.IO',
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
          id: 'providers/alibaba-coding-plan',
          label: 'Alibaba Coding Plan',
        },
        {
          type: 'doc',
          id: 'providers/alibaba-coding-plan-cn',
          label: 'Alibaba Coding Plan (China)',
        },
        {
          type: 'doc',
          id: 'providers/alibaba-token-plan',
          label: 'Alibaba Token Plan',
        },
        {
          type: 'doc',
          id: 'providers/alibaba-token-plan-cn',
          label: 'Alibaba Token Plan (China)',
        },
        {
          type: 'doc',
          id: 'providers/amazon-bedrock',
          label: 'Amazon Bedrock',
        },
        {
          type: 'doc',
          id: 'providers/ambient',
          label: 'Ambient',
        },
        {
          type: 'doc',
          id: 'providers/amd',
          label: 'AMD',
        },
        {
          type: 'doc',
          id: 'providers/anonrouter',
          label: 'AnonRouter',
        },
        {
          type: 'doc',
          id: 'providers/anyapi',
          label: 'AnyAPI',
        },
        {
          type: 'doc',
          id: 'providers/apiko',
          label: 'APIKO',
        },
        {
          type: 'doc',
          id: 'providers/arcee',
          label: 'Arcee',
        },
        {
          type: 'doc',
          id: 'providers/atomic-chat',
          label: 'Atomic Chat',
        },
        {
          type: 'doc',
          id: 'providers/augure',
          label: 'Augure',
        },
        {
          type: 'doc',
          id: 'providers/auriko',
          label: 'Auriko',
        },
        {
          type: 'doc',
          id: 'providers/autarcho',
          label: 'Autarcho',
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
          id: 'providers/bee',
          label: 'Bee by HEOSSI',
        },
        {
          type: 'doc',
          id: 'providers/berget',
          label: 'Berget.AI',
        },
        {
          type: 'doc',
          id: 'providers/blueclaw',
          label: 'Blue Claw',
        },
        {
          type: 'doc',
          id: 'providers/bothub',
          label: 'Bothub',
        },
        {
          type: 'doc',
          id: 'providers/boundless',
          label: 'Boundless',
        },
        {
          type: 'doc',
          id: 'providers/bumo',
          label: 'Bumo Router',
        },
        {
          type: 'doc',
          id: 'providers/byteplus',
          label: 'BytePlus ModelArk',
        },
        {
          type: 'doc',
          id: 'providers/cedarllm',
          label: 'CedarLLM',
        },
        {
          type: 'doc',
          id: 'providers/cerebras',
          label: 'Cerebras',
        },
        {
          type: 'doc',
          id: 'providers/hyper',
          label: 'Charm Hyper',
        },
        {
          type: 'doc',
          id: 'providers/cheapaimodel',
          label: 'cheapaimodel',
        },
        {
          type: 'doc',
          id: 'providers/cheapest-token',
          label: 'CheapestToken',
        },
        {
          type: 'doc',
          id: 'providers/cheapllm',
          label: 'cheapllm.shop',
        },
        {
          type: 'doc',
          id: 'providers/chutes',
          label: 'Chutes',
        },
        {
          type: 'doc',
          id: 'providers/clarifai',
          label: 'Clarifai',
        },
        {
          type: 'doc',
          id: 'providers/claudinio',
          label: 'Claudinio',
        },
        {
          type: 'doc',
          id: 'providers/cline-pass',
          label: 'ClinePass',
        },
        {
          type: 'doc',
          id: 'providers/cloudcode',
          label: 'CloudCode.ONE',
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
          id: 'providers/commandcode',
          label: 'CommandCode',
        },
        {
          type: 'doc',
          id: 'providers/confidential-ai',
          label: 'Confidential AI',
        },
        {
          type: 'doc',
          id: 'providers/coralbricks',
          label: 'CoralBricks',
        },
        {
          type: 'doc',
          id: 'providers/wandb',
          label: 'CoreWeave',
        },
        {
          type: 'doc',
          id: 'providers/cortecs',
          label: 'Cortecs',
        },
        {
          type: 'doc',
          id: 'providers/crossmodel',
          label: 'CrossModel',
        },
        {
          type: 'doc',
          id: 'providers/crusoe',
          label: 'Crusoe',
        },
        {
          type: 'doc',
          id: 'providers/drun',
          label: 'D.Run (China)',
        },
        {
          type: 'doc',
          id: 'providers/daoxe',
          label: 'DaoXE',
        },
        {
          type: 'doc',
          id: 'providers/databricks',
          label: 'Databricks',
        },
        {
          type: 'doc',
          id: 'providers/deepinfra',
          label: 'Deep Infra',
        },
        {
          type: 'doc',
          id: 'providers/llmgateway',
          label: 'DevPass (LLM Gateway)',
        },
        {
          type: 'doc',
          id: 'providers/digitalocean',
          label: 'DigitalOcean',
        },
        {
          type: 'doc',
          id: 'providers/dinference',
          label: 'DInference',
        },
        {
          type: 'doc',
          id: 'providers/dothoosh',
          label: 'DotHoosh',
        },
        {
          type: 'doc',
          id: 'providers/doubleword',
          label: 'Doubleword',
        },
        {
          type: 'doc',
          id: 'providers/ebcloud',
          label: 'EBCloud',
        },
        {
          type: 'doc',
          id: 'providers/echo',
          label: 'Echo',
        },
        {
          type: 'doc',
          id: 'providers/edenai',
          label: 'Eden AI',
        },
        {
          type: 'doc',
          id: 'providers/empiriolabs',
          label: 'EmpirioLabs AI',
        },
        {
          type: 'doc',
          id: 'providers/engy',
          label: 'engy',
        },
        {
          type: 'doc',
          id: 'providers/entrim',
          label: 'Entrim',
        },
        {
          type: 'doc',
          id: 'providers/evroc',
          label: 'evroc',
        },
        {
          type: 'doc',
          id: 'providers/ezkielyna',
          label: 'Ezkielyna',
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
          id: 'providers/fortytwo',
          label: 'Fortytwo',
        },
        {
          type: 'doc',
          id: 'providers/freemodel',
          label: 'FreeModel',
        },
        {
          type: 'doc',
          id: 'providers/frequency',
          label: 'Frequency',
        },
        {
          type: 'doc',
          id: 'providers/friendli',
          label: 'Friendli',
        },
        {
          type: 'doc',
          id: 'providers/frogbot',
          label: 'FrogBot',
        },
        {
          type: 'doc',
          id: 'providers/gisoo',
          label: 'Gisoo',
        },
        {
          type: 'doc',
          id: 'providers/gmicloud',
          label: 'GMI Cloud',
        },
        {
          type: 'doc',
          id: 'providers/google-vertex',
          label: 'Google Vertex AI',
        },
        {
          type: 'doc',
          id: 'providers/graphn',
          label: 'GraphN',
        },
        {
          type: 'doc',
          id: 'providers/greenpt',
          label: 'GreenPT',
        },
        {
          type: 'doc',
          id: 'providers/helicone',
          label: 'Helicone',
        },
        {
          type: 'doc',
          id: 'providers/hetzner',
          label: 'Hetzner',
        },
        {
          type: 'doc',
          id: 'providers/hopper',
          label: 'Hopper',
        },
        {
          type: 'doc',
          id: 'providers/hostinger-router',
          label: 'Hostinger Router',
        },
        {
          type: 'doc',
          id: 'providers/hpc-ai',
          label: 'HPC-AI',
        },
        {
          type: 'doc',
          id: 'providers/huawei-maas',
          label: 'Huawei Cloud MAAS',
        },
        {
          type: 'doc',
          id: 'providers/hubris',
          label: 'Hubris',
        },
        {
          type: 'doc',
          id: 'providers/huggingface',
          label: 'Hugging Face',
        },
        {
          type: 'doc',
          id: 'providers/humain',
          label: 'HUMAIN',
        },
        {
          type: 'doc',
          id: 'providers/impossibl',
          label: 'Impossibl',
        },
        {
          type: 'doc',
          id: 'providers/inception',
          label: 'Inception',
        },
        {
          type: 'doc',
          id: 'providers/inceptron',
          label: 'Inceptron',
        },
        {
          type: 'doc',
          id: 'providers/inco',
          label: 'Inco',
        },
        {
          type: 'doc',
          id: 'providers/infer',
          label: 'Infer by Flow7',
        },
        {
          type: 'doc',
          id: 'providers/inferall',
          label: 'InferAll',
        },
        {
          type: 'doc',
          id: 'providers/inference',
          label: 'Inference',
        },
        {
          type: 'doc',
          id: 'providers/inferenceapis',
          label: 'Inference APIs',
        },
        {
          type: 'doc',
          id: 'providers/inference-coop',
          label: 'Inference Cooperative',
        },
        {
          type: 'doc',
          id: 'providers/inferris',
          label: 'Inferris',
        },
        {
          type: 'doc',
          id: 'providers/infersia',
          label: 'Infersia',
        },
        {
          type: 'doc',
          id: 'providers/inferx',
          label: 'InferX',
        },
        {
          type: 'doc',
          id: 'providers/infomaniak',
          label: 'Infomaniak',
        },
        {
          type: 'doc',
          id: 'providers/io-net',
          label: 'IO.NET',
        },
        {
          type: 'doc',
          id: 'providers/isoquant',
          label: 'Isoquant',
        },
        {
          type: 'doc',
          id: 'providers/iteracompute',
          label: 'IteraCompute',
        },
        {
          type: 'doc',
          id: 'providers/jad-ai',
          label: 'Jad AI',
        },
        {
          type: 'doc',
          id: 'providers/jalapeno',
          label: 'Jalapeno Cloud',
        },
        {
          type: 'doc',
          id: 'providers/jiekou',
          label: 'Jiekou.AI',
        },
        {
          type: 'doc',
          id: 'providers/joingonka',
          label: 'JoinGonka',
        },
        {
          type: 'doc',
          id: 'providers/jzstoken',
          label: 'JZSTOKEN',
        },
        {
          type: 'doc',
          id: 'providers/keln',
          label: 'Keln',
        },
        {
          type: 'doc',
          id: 'providers/kenari',
          label: 'Kenari',
        },
        {
          type: 'doc',
          id: 'providers/kilo',
          label: 'Kilo Gateway',
        },
        {
          type: 'doc',
          id: 'providers/kimi-code-plan-global',
          label: 'Kimi For Coding (kimi.ai)',
        },
        {
          type: 'doc',
          id: 'providers/kimi-code-plan-cn',
          label: 'Kimi For Coding (kimi.com)',
        },
        {
          type: 'doc',
          id: 'providers/kitani',
          label: 'Kitani',
        },
        {
          type: 'doc',
          id: 'providers/klavo',
          label: 'Klavo AI',
        },
        {
          type: 'doc',
          id: 'providers/klokintegration',
          label: 'klokintegration.se',
        },
        {
          type: 'doc',
          id: 'providers/korouter',
          label: 'KoRouter',
        },
        {
          type: 'doc',
          id: 'providers/kosmik',
          label: 'Kosmik Compute',
        },
        {
          type: 'doc',
          id: 'providers/kuae-cloud-coding-plan',
          label: 'KUAE Cloud Coding Plan',
        },
        {
          type: 'doc',
          id: 'providers/kunavo',
          label: 'Kunavo',
        },
        {
          type: 'doc',
          id: 'providers/liquid',
          label: 'Liquid Inference',
        },
        {
          type: 'doc',
          id: 'providers/lithosai',
          label: 'LithosAI',
        },
        {
          type: 'doc',
          id: 'providers/llmgateway-providers',
          label: 'LLM Gateway',
        },
        {
          type: 'doc',
          id: 'providers/llmtech',
          label: 'LLM Tech',
        },
        {
          type: 'doc',
          id: 'providers/llmtr',
          label: 'LLMTR',
        },
        {
          type: 'doc',
          id: 'providers/lmstudio',
          label: 'LMStudio',
        },
        {
          type: 'doc',
          id: 'providers/logits',
          label: 'Logits',
        },
        {
          type: 'doc',
          id: 'providers/longcat',
          label: 'LongCat',
        },
        {
          type: 'doc',
          id: 'providers/lowrouter',
          label: 'LowRouter',
        },
        {
          type: 'doc',
          id: 'providers/lucidquery',
          label: 'LucidQuery',
        },
        {
          type: 'doc',
          id: 'providers/lyceum',
          label: 'Lyceum',
        },
        {
          type: 'doc',
          id: 'providers/lynkr',
          label: 'Lynkr',
        },
        {
          type: 'doc',
          id: 'providers/mallard',
          label: 'Mallard AI',
        },
        {
          type: 'doc',
          id: 'providers/meganova',
          label: 'Meganova',
        },
        {
          type: 'doc',
          id: 'providers/melious',
          label: 'Melious',
        },
        {
          type: 'doc',
          id: 'providers/meragpt',
          label: 'meraGPT',
        },
        {
          type: 'doc',
          id: 'providers/meta',
          label: 'Meta',
        },
        {
          type: 'doc',
          id: 'providers/minimax-cn',
          label: 'MiniMax (minimax.cn)',
        },
        {
          type: 'doc',
          id: 'providers/minimax',
          label: 'MiniMax (minimax.io)',
        },
        {
          type: 'doc',
          id: 'providers/minimax-cn-coding-plan',
          label: 'MiniMax Token Plan (minimax.cn)',
        },
        {
          type: 'doc',
          id: 'providers/minimax-coding-plan',
          label: 'MiniMax Token Plan (minimax.io)',
        },
        {
          type: 'doc',
          id: 'providers/mixlayer',
          label: 'Mixlayer',
        },
        {
          type: 'doc',
          id: 'providers/moark',
          label: 'Moark',
        },
        {
          type: 'doc',
          id: 'providers/modal',
          label: 'Modal',
        },
        {
          type: 'doc',
          id: 'providers/model-oracle-ai',
          label: 'Model Oracle AI',
        },
        {
          type: 'doc',
          id: 'providers/modelis',
          label: 'Modelis',
        },
        {
          type: 'doc',
          id: 'providers/modelscope',
          label: 'ModelScope',
        },
        {
          type: 'doc',
          id: 'providers/modular',
          label: 'Modular',
        },
        {
          type: 'doc',
          id: 'providers/moneo',
          label: 'Moneo',
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
          id: 'providers/munito',
          label: 'Munito AI',
        },
        {
          type: 'doc',
          id: 'providers/munito-eu',
          label: 'Munito AI (EU)',
        },
        {
          type: 'doc',
          id: 'providers/nan',
          label: 'NaN',
        },
        {
          type: 'doc',
          id: 'providers/nano-gpt',
          label: 'NanoGPT',
        },
        {
          type: 'doc',
          id: 'providers/nearai',
          label: 'NEAR AI Cloud',
        },
        {
          type: 'doc',
          id: 'providers/nebius',
          label: 'Nebius Token Factory',
        },
        {
          type: 'doc',
          id: 'providers/neosmith',
          label: 'NeoSmith',
        },
        {
          type: 'doc',
          id: 'providers/neuralwatt',
          label: 'Neuralwatt',
        },
        {
          type: 'doc',
          id: 'providers/nodecode',
          label: 'Nodecode',
        },
        {
          type: 'doc',
          id: 'providers/nokeep',
          label: 'nokeep',
        },
        {
          type: 'doc',
          id: 'providers/nova',
          label: 'Nova',
        },
        {
          type: 'doc',
          id: 'providers/novita-ai',
          label: 'Novita AI',
        },
        {
          type: 'doc',
          id: 'providers/nvidia',
          label: 'Nvidia',
        },
        {
          type: 'doc',
          id: 'providers/oathbreaker',
          label: 'Oathbreaker AI',
        },
        {
          type: 'doc',
          id: 'providers/obscurify',
          label: 'Obscurify.ai',
        },
        {
          type: 'doc',
          id: 'providers/oci',
          label: 'OCI Generative AI',
        },
        {
          type: 'doc',
          id: 'providers/ofox',
          label: 'Ofox',
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
          id: 'providers/opencode',
          label: 'OpenCode',
        },
        {
          type: 'doc',
          id: 'providers/opencode-go',
          label: 'OpenCode Go',
        },
        {
          type: 'doc',
          id: 'providers/openreason',
          label: 'OpenReason',
        },
        {
          type: 'doc',
          id: 'providers/opper',
          label: 'Opper',
        },
        {
          type: 'doc',
          id: 'providers/orcarouter',
          label: 'OrcaRouter',
        },
        {
          type: 'doc',
          id: 'providers/outerlabs',
          label: 'Outer Labs',
        },
        {
          type: 'doc',
          id: 'providers/ovhcloud',
          label: 'OVHcloud AI Endpoints',
        },
        {
          type: 'doc',
          id: 'providers/paraloncloud',
          label: 'ParalonCloud',
        },
        {
          type: 'doc',
          id: 'providers/unbiased',
          label: 'Pareto by Unbiased',
        },
        {
          type: 'doc',
          id: 'providers/pareto',
          label: 'Pareto Inference',
        },
        {
          type: 'doc',
          id: 'providers/pendra',
          label: 'Pendra',
        },
        {
          type: 'doc',
          id: 'providers/perplexity',
          label: 'Perplexity',
        },
        {
          type: 'doc',
          id: 'providers/perplexity-agent',
          label: 'Perplexity Agent',
        },
        {
          type: 'doc',
          id: 'providers/phala',
          label: 'Phala',
        },
        {
          type: 'doc',
          id: 'providers/phase',
          label: 'Phase Router',
        },
        {
          type: 'doc',
          id: 'providers/pioneer',
          label: 'Pioneer',
        },
        {
          type: 'doc',
          id: 'providers/poe',
          label: 'Poe',
        },
        {
          type: 'doc',
          id: 'providers/poolside',
          label: 'Poolside',
        },
        {
          type: 'doc',
          id: 'providers/powerspring',
          label: 'Powerspring',
        },
        {
          type: 'doc',
          id: 'providers/prime',
          label: 'Prime Inference',
        },
        {
          type: 'doc',
          id: 'providers/privatemode-ai',
          label: 'Privatemode AI',
        },
        {
          type: 'doc',
          id: 'providers/proxystacks',
          label: 'ProxyStacks Relay',
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
          id: 'providers/qvac',
          label: 'QVAC',
        },
        {
          type: 'doc',
          id: 'providers/rayline',
          label: 'Rayline',
        },
        {
          type: 'doc',
          id: 'providers/reflection',
          label: 'Reflection',
        },
        {
          type: 'doc',
          id: 'providers/refuseless',
          label: 'Refuseless',
        },
        {
          type: 'doc',
          id: 'providers/regolo-ai',
          label: 'Regolo AI',
        },
        {
          type: 'doc',
          id: 'providers/routing-run',
          label: 'routing.run',
        },
        {
          type: 'doc',
          id: 'providers/ruapi',
          label: 'RuAPI',
        },
        {
          type: 'doc',
          id: 'providers/runcrate',
          label: 'Runcrate',
        },
        {
          type: 'doc',
          id: 'providers/runinfra',
          label: 'RunInfra',
        },
        {
          type: 'doc',
          id: 'providers/sagg',
          label: 'SAGG',
        },
        {
          type: 'doc',
          id: 'providers/sakana',
          label: 'Sakana AI',
        },
        {
          type: 'doc',
          id: 'providers/sambanova',
          label: 'SambaNova',
        },
        {
          type: 'doc',
          id: 'providers/sandbase',
          label: 'SandBase',
        },
        {
          type: 'doc',
          id: 'providers/sarvam',
          label: 'Sarvam AI',
        },
        {
          type: 'doc',
          id: 'providers/scaleway',
          label: 'Scaleway',
        },
        {
          type: 'doc',
          id: 'providers/scnet-token-plan',
          label: 'SCNet Token Plan',
        },
        {
          type: 'doc',
          id: 'providers/scx-ai',
          label: 'SCX.ai',
        },
        {
          type: 'doc',
          id: 'providers/sensenova',
          label: 'SenseNova (China)',
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
          id: 'providers/snowflake-cortex',
          label: 'Snowflake Cortex',
        },
        {
          type: 'doc',
          id: 'providers/sokkan',
          label: 'SOKKAN Router',
        },
        {
          type: 'doc',
          id: 'providers/sparrowcodes',
          label: 'SparrowCodes',
        },
        {
          type: 'doc',
          id: 'providers/stackit',
          label: 'STACKIT',
        },
        {
          type: 'doc',
          id: 'providers/standardcompute',
          label: 'Standard Compute',
        },
        {
          type: 'doc',
          id: 'providers/steadyrouter',
          label: 'SteadyRouter',
        },
        {
          type: 'doc',
          id: 'providers/stepfun',
          label: 'StepFun (China)',
        },
        {
          type: 'doc',
          id: 'providers/stepfun-ai',
          label: 'StepFun (Global)',
        },
        {
          type: 'doc',
          id: 'providers/stepfun-step-plan',
          label: 'StepFun Step Plan (China)',
        },
        {
          type: 'doc',
          id: 'providers/stepfun-ai-step-plan',
          label: 'StepFun Step Plan (Global)',
        },
        {
          type: 'doc',
          id: 'providers/stepping-stone',
          label: 'stepping stone AG',
        },
        {
          type: 'doc',
          id: 'providers/subconscious',
          label: 'Subconscious',
        },
        {
          type: 'doc',
          id: 'providers/submodel',
          label: 'submodel',
        },
        {
          type: 'doc',
          id: 'providers/superbot-gg',
          label: 'superbot',
        },
        {
          type: 'doc',
          id: 'providers/synthetic',
          label: 'Synthetic',
        },
        {
          type: 'doc',
          id: 'providers/synthorai',
          label: 'Synthorai',
        },
        {
          type: 'doc',
          id: 'providers/teamorouter',
          label: 'TeamoRouter',
        },
        {
          type: 'doc',
          id: 'providers/teapot-router',
          label: 'Teapot Router',
        },
        {
          type: 'doc',
          id: 'providers/tencent-coding-plan',
          label: 'Tencent Coding Plan (China)',
        },
        {
          type: 'doc',
          id: 'providers/tencent-token-plan',
          label: 'Tencent Token Plan',
        },
        {
          type: 'doc',
          id: 'providers/tencent-tokenhub',
          label: 'Tencent TokenHub',
        },
        {
          type: 'doc',
          id: 'providers/tensorx',
          label: 'TensorX',
        },
        {
          type: 'doc',
          id: 'providers/tenstorrent',
          label: 'Tenstorrent',
        },
        {
          type: 'doc',
          id: 'providers/the-grid-ai',
          label: 'The Grid AI',
        },
        {
          type: 'doc',
          id: 'providers/therouter',
          label: 'TheRouter',
        },
        {
          type: 'doc',
          id: 'providers/thinkingmachines',
          label: 'Thinking Machines',
        },
        {
          type: 'doc',
          id: 'providers/tinfoil',
          label: 'Tinfoil',
        },
        {
          type: 'doc',
          id: 'providers/toapis',
          label: 'ToAPIs',
        },
        {
          type: 'doc',
          id: 'providers/togetherai',
          label: 'Together AI',
        },
        {
          type: 'doc',
          id: 'providers/tokengo',
          label: 'TokenGo',
        },
        {
          type: 'doc',
          id: 'providers/tokenify',
          label: 'Tokenify',
        },
        {
          type: 'doc',
          id: 'providers/tokenlab',
          label: 'TokenLab',
        },
        {
          type: 'doc',
          id: 'providers/tokenrouter',
          label: 'TokenRouter',
        },
        {
          type: 'doc',
          id: 'providers/tokenwatt',
          label: 'TokenWatt',
        },
        {
          type: 'doc',
          id: 'providers/trustedrouter',
          label: 'TrustedRouter',
        },
        {
          type: 'doc',
          id: 'providers/trustedtokens',
          label: 'TrustedTokens',
        },
        {
          type: 'doc',
          id: 'providers/umans-ai',
          label: 'Umans AI',
        },
        {
          type: 'doc',
          id: 'providers/umans-ai-coding-plan',
          label: 'Umans AI Coding Plan',
        },
        {
          type: 'doc',
          id: 'providers/uncensuredai',
          label: 'UncensuredAI',
        },
        {
          type: 'doc',
          id: 'providers/unorouter',
          label: 'UnoRouter',
        },
        {
          type: 'doc',
          id: 'providers/unrestricted',
          label: 'Unrestricted',
        },
        {
          type: 'doc',
          id: 'providers/uplinkswitch',
          label: 'UplinkSwitch',
        },
        {
          type: 'doc',
          id: 'providers/upstage',
          label: 'Upstage',
        },
        {
          type: 'doc',
          id: 'providers/vancine',
          label: 'Vancine',
        },
        {
          type: 'doc',
          id: 'providers/verda',
          label: 'Verda',
        },
        {
          type: 'doc',
          id: 'providers/vispark',
          label: 'Vispark',
        },
        {
          type: 'doc',
          id: 'providers/vivgrid',
          label: 'Vivgrid',
        },
        {
          type: 'doc',
          id: 'providers/volcengine',
          label: 'Volcengine Ark',
        },
        {
          type: 'doc',
          id: 'providers/volcengine-coding-plan',
          label: 'Volcengine Ark Coding Plan',
        },
        {
          type: 'doc',
          id: 'providers/vultr',
          label: 'Vultr',
        },
        {
          type: 'doc',
          id: 'providers/wafer.ai',
          label: 'Wafer',
        },
        {
          type: 'doc',
          id: 'providers/wallaby',
          label: 'Wallaby',
        },
        {
          type: 'doc',
          id: 'providers/wally',
          label: 'Wally',
        },
        {
          type: 'doc',
          id: 'providers/watt',
          label: 'Watt Cloud',
        },
        {
          type: 'doc',
          id: 'providers/xiaomi',
          label: 'Xiaomi',
        },
        {
          type: 'doc',
          id: 'providers/xiaomi-token-plan-cn',
          label: 'Xiaomi Token Plan (China)',
        },
        {
          type: 'doc',
          id: 'providers/xiaomi-token-plan-ams',
          label: 'Xiaomi Token Plan (Europe)',
        },
        {
          type: 'doc',
          id: 'providers/xiaomi-token-plan-sgp',
          label: 'Xiaomi Token Plan (Singapore)',
        },
        {
          type: 'doc',
          id: 'providers/xpersona',
          label: 'Xpersona',
        },
        {
          type: 'doc',
          id: 'providers/xxapi',
          label: 'xxapi',
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
          id: 'providers/zeldoc',
          label: 'Zeldoc',
        },
        {
          type: 'doc',
          id: 'providers/zenifra',
          label: 'Zenifra',
        },
        {
          type: 'doc',
          id: 'providers/zenmux',
          label: 'ZenMux',
        },
        {
          type: 'doc',
          id: 'providers/zerogpu',
          label: 'ZeroGPU',
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
        {
          type: 'doc',
          id: 'providers/zro',
          label: 'Zro',
        },
      ],
    },
  ],
}

export default sidebars
