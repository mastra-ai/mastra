import { AmazonIcon } from '@mastra/playground-ui/icons/AmazonIcon';
import { AnthropicChatIcon } from '@mastra/playground-ui/icons/AnthropicChatIcon';
import { AnthropicMessagesIcon } from '@mastra/playground-ui/icons/AnthropicMessagesIcon';
import { AzureIcon } from '@mastra/playground-ui/icons/AzureIcon';
import { CohereIcon } from '@mastra/playground-ui/icons/CohereIcon';
import { GoogleIcon } from '@mastra/playground-ui/icons/GoogleIcon';
import { GroqIcon } from '@mastra/playground-ui/icons/GroqIcon';
import { MastraIcon } from '@mastra/playground-ui/icons/MastraIcon';
import { MistralIcon } from '@mastra/playground-ui/icons/MistralIcon';
import { NetlifyIcon } from '@mastra/playground-ui/icons/NetlifyIcon';
import { OpenaiChatIcon } from '@mastra/playground-ui/icons/OpenaiChatIcon';
import { XGroqIcon } from '@mastra/playground-ui/icons/XGroqIcon';

export const providerMapToIcon = {
  'openai.chat': <OpenaiChatIcon />,
  'openai.responses': <OpenaiChatIcon />,
  'anthropic.chat': <AnthropicChatIcon />,
  'anthropic.messages': <AnthropicMessagesIcon />,
  AZURE: <AzureIcon />,
  AMAZON: <AmazonIcon />,
  GOOGLE: <GoogleIcon />,
  COHERE: <CohereIcon />,
  GROQ: <GroqIcon />,
  X_GROK: <XGroqIcon />,
  MISTRAL: <MistralIcon />,
  netlify: <NetlifyIcon />,
  mastra: <MastraIcon />,
};
