export interface PackageInfo {
  name: string;
  displayName: string;
  path: string;
}

// Deployers
export const DEPLOYERS: PackageInfo[] = [
  { name: 'cloudflare', displayName: 'Cloudflare Deployer', path: 'deployers/cloudflare' },
  { name: 'netlify', displayName: 'Netlify Deployer', path: 'deployers/netlify' },
  { name: 'vercel', displayName: 'Vercel Deployer', path: 'deployers/vercel' },
];

// Integrations
export const INTEGRATIONS: PackageInfo[] = [
  { name: 'composio', displayName: 'Compos.io Integration', path: 'integrations/composio' },
  { name: 'firecrawl', displayName: 'Firecrawl Integration', path: 'integrations/firecrawl' },
  { name: 'github', displayName: 'GitHub Integration', path: 'integrations/github' },
  { name: 'ragie', displayName: 'Ragie Integration', path: 'integrations/ragie' },
  { name: 'stabilityai', displayName: 'Stability AI Integration', path: 'integrations/stabilityai' },
];

// Client SDKs
export const CLIENT_SDKS: PackageInfo[] = [{ name: 'js', displayName: 'Client JS', path: 'client-sdks/client-js' }];

// Packages
export const CORE_PACKAGES: PackageInfo[] = [
  { name: 'cli', displayName: 'CLI', path: 'packages/cli' },
  { name: 'core', displayName: 'Core', path: 'packages/core' },
  { name: 'create-mastra', displayName: 'Create Mastra', path: 'packages/create-mastra' },
  { name: 'deployer', displayName: 'Deployer', path: 'packages/deployer' },
  { name: 'evals', displayName: 'Evals', path: 'packages/evals' },
  { name: 'loggers', displayName: 'Loggers', path: 'packages/loggers' },
  { name: 'mcp', displayName: 'MCP', path: 'packages/mcp' },
  { name: 'memory', displayName: 'Memory', path: 'packages/memory' },
  { name: 'playground-ui', displayName: 'Playground UI', path: 'packages/playground-ui' },
  { name: 'rag', displayName: 'RAG', path: 'packages/rag' },
];

// Speech
export const SPEECH_PACKAGES: PackageInfo[] = [
  { name: 'azure-speech', displayName: 'Azure Speech', path: 'speech/azure' },
  { name: 'deepgram-speech', displayName: 'Deepgram Speech', path: 'speech/deepgram' },
  { name: 'elevenlabs-speech', displayName: 'ElevenLabs Speech', path: 'speech/elevenlabs' },
  { name: 'google-speech', displayName: 'Google Speech', path: 'speech/google' },
  { name: 'ibm-speech', displayName: 'IBM Speech', path: 'speech/ibm' },
  { name: 'murf-speech', displayName: 'Murf Speech', path: 'speech/murf' },
  { name: 'openai-speech', displayName: 'OpenAI Speech', path: 'speech/openai' },
  { name: 'playai-speech', displayName: 'Play.ai Speech', path: 'speech/playai' },
  { name: 'replicate-speech', displayName: 'Replicate Speech', path: 'speech/replicate' },
  { name: 'speechify-speech', displayName: 'Speechify Speech', path: 'speech/speechify' },
];

// Stores
export const STORE_PACKAGES: PackageInfo[] = [
  { name: 'astra', displayName: 'Astra Store', path: 'stores/astra' },
  { name: 'chroma', displayName: 'Chroma Store', path: 'stores/chroma' },
  { name: 'pg', displayName: 'PostgreSQL Store', path: 'stores/pg' },
  { name: 'pinecone', displayName: 'Pinecone Store', path: 'stores/pinecone' },
  { name: 'qdrant', displayName: 'Qdrant Store', path: 'stores/qdrant' },
  { name: 'upstash', displayName: 'Upstash Store', path: 'stores/upstash' },
  { name: 'vectorize', displayName: 'Vectorize Store', path: 'stores/vectorize' },
];

// Voice
export const VOICE_PACKAGES: PackageInfo[] = [
  { name: 'deepgram-voice', displayName: 'Deepgram Voice', path: 'voice/deepgram' },
  { name: 'elevenlabs-voice', displayName: 'ElevenLabs Voice', path: 'voice/elevenlabs' },
  { name: 'google-voice', displayName: 'Google Voice', path: 'voice/google' },
  { name: 'murf-voice', displayName: 'Murf Voice', path: 'voice/murf' },
  { name: 'openai-voice', displayName: 'OpenAI Voice', path: 'voice/openai' },
  { name: 'playai-voice', displayName: 'Play.ai Voice', path: 'voice/playai' },
  { name: 'speechify-voice', displayName: 'Speechify Voice', path: 'voice/speechify' },
];
