import { OpenaiChatIcon } from '@/ds/icons/OpenaiChatIcon';
import { AnthropicChatIcon } from '@/ds/icons/AnthropicChatIcon';
import { AnthropicMessagesIcon } from '@/ds/icons/AnthropicMessagesIcon';
import { AzureIcon } from '@/ds/icons/AzureIcon';
import { AmazonIcon } from '@/ds/icons/AmazonIcon';
import { GoogleIcon } from '@/ds/icons';
import { CohereIcon } from '@/ds/icons/CohereIcon';
import { GroqIcon } from '@/ds/icons/GroqIcon';
import { XGroqIcon } from '@/ds/icons/XGroqIcon';
import { MistralIcon } from '@/ds/icons/MistralIcon';

export const providerMapToIcon = {
  'openai.chat': <OpenaiChatIcon />,
  'anthropic.chat': <AnthropicChatIcon />,
  'anthropic.messages': <AnthropicMessagesIcon />,
  AZURE: <AzureIcon />,
  AMAZON: <AmazonIcon />,
  GOOGLE: <GoogleIcon />,
  COHERE: <CohereIcon />,
  GROQ: <GroqIcon />,
  X_GROK: <XGroqIcon />,
  MISTRAL: <MistralIcon />,
};
