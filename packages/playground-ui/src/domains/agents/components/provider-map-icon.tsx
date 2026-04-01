import { GoogleIcon } from '@/ds/icons';
import { AmazonIcon } from '@/ds/icons/AmazonIcon';
import { AnthropicChatIcon } from '@/ds/icons/AnthropicChatIcon';
import { AnthropicMessagesIcon } from '@/ds/icons/AnthropicMessagesIcon';
import { AzureIcon } from '@/ds/icons/AzureIcon';
import { CohereIcon } from '@/ds/icons/CohereIcon';
import { GroqIcon } from '@/ds/icons/GroqIcon';
import { MistralIcon } from '@/ds/icons/MistralIcon';
import { MastraIcon } from '@/ds/icons/MastraIcon';
import { NetlifyIcon } from '@/ds/icons/NetlifyIcon';
import { OpenaiChatIcon } from '@/ds/icons/OpenaiChatIcon';
import { XGroqIcon } from '@/ds/icons/XGroqIcon';

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
