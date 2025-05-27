import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Check from "./svgs/check-circle";
import { X as Cross } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
// Model capability data from model-capability.mdx
const modelData = [
  {
    provider: "xAI Grok",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/xai",
    model: "grok-3",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "XAI_API_KEY",
  },
  {
    provider: "xAI Grok",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/xai",
    model: "grok-3-fast",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "XAI_API_KEY",
  },
  {
    provider: "xAI Grok",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/xai",
    model: "grok-3-mini",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "XAI_API_KEY",
  },
  {
    provider: "xAI Grok",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/xai",
    model: "grok-3-mini-fast",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "XAI_API_KEY",
  },
  {
    provider: "xAI Grok",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/xai",
    model: "grok-2-1212",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "XAI_API_KEY",
  },
  {
    provider: "xAI Grok",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/xai",
    model: "grok-2-vision-1212",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "XAI_API_KEY",
  },
  {
    provider: "xAI Grok",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/xai",
    model: "grok-beta",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "XAI_API_KEY",
  },
  {
    provider: "xAI Grok",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/xai",
    model: "grok-vision-beta",
    imageInput: true,
    objectGeneration: false,
    toolUsage: false,
    toolStreaming: false,
    apiKey: "XAI_API_KEY",
  },
  {
    provider: "OpenAI",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/openai",
    model: "gpt-4.1",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "OPENAI_API_KEY",
  },
  {
    provider: "OpenAI",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/openai",
    model: "gpt-4.1-mini",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "OPENAI_API_KEY",
  },
  {
    provider: "OpenAI",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/openai",
    model: "gpt-4.1-nano",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "OPENAI_API_KEY",
  },
  {
    provider: "OpenAI",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/openai",
    model: "gpt-4o",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "OPENAI_API_KEY",
  },
  {
    provider: "OpenAI",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/openai",
    model: "gpt-4o-mini",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "OPENAI_API_KEY",
  },
  {
    provider: "OpenAI",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/openai",
    model: "gpt-4-turbo",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "OPENAI_API_KEY",
  },
  {
    provider: "OpenAI",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/openai",
    model: "gpt-4",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "OPENAI_API_KEY",
  },
  {
    provider: "OpenAI",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/openai",
    model: "o3-mini",
    imageInput: false,
    objectGeneration: false,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "OPENAI_API_KEY",
  },
  {
    provider: "OpenAI",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/openai",
    model: "o1",
    imageInput: true,
    objectGeneration: false,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "OPENAI_API_KEY",
  },
  {
    provider: "OpenAI",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/openai",
    model: "o1-mini",
    imageInput: true,
    objectGeneration: false,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "OPENAI_API_KEY",
  },
  {
    provider: "OpenAI",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/openai",
    model: "o1-preview",
    imageInput: false,
    objectGeneration: false,
    toolUsage: false,
    toolStreaming: false,
    apiKey: "OPENAI_API_KEY",
  },
  {
    provider: "Anthropic",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic",
    model: "claude-3-7-sonnet-20250219",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "ANTHROPIC_API_KEY",
  },
  {
    provider: "Anthropic",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic",
    model: "claude-3-5-sonnet-20241022",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "ANTHROPIC_API_KEY",
  },
  {
    provider: "Anthropic",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic",
    model: "claude-3-5-sonnet-20240620",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "ANTHROPIC_API_KEY",
  },
  {
    provider: "Anthropic",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic",
    model: "claude-3-5-haiku-20241022",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "ANTHROPIC_API_KEY",
  },
  {
    provider: "Mistral",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/mistral",
    model: "pixtral-large-latest",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "MISTRAL_API_KEY",
  },
  {
    provider: "Mistral",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/mistral",
    model: "mistral-large-latest",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "MISTRAL_API_KEY",
  },
  {
    provider: "Mistral",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/mistral",
    model: "mistral-small-latest",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "MISTRAL_API_KEY",
  },
  {
    provider: "Mistral",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/mistral",
    model: "pixtral-12b-2409",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "MISTRAL_API_KEY",
  },
  {
    provider: "Google Generative AI",
    providerUrl:
      "https://sdk.vercel.ai/providers/ai-sdk-providers/google-generative-ai",
    model: "gemini-2.0-flash-exp",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "GOOGLE_API_KEY",
  },
  {
    provider: "Google Generative AI",
    providerUrl:
      "https://sdk.vercel.ai/providers/ai-sdk-providers/google-generative-ai",
    model: "gemini-1.5-flash",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "GOOGLE_API_KEY",
  },
  {
    provider: "Google Generative AI",
    providerUrl:
      "https://sdk.vercel.ai/providers/ai-sdk-providers/google-generative-ai",
    model: "gemini-1.5-pro",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "GOOGLE_API_KEY",
  },
  {
    provider: "Google Vertex",
    providerUrl:
      "https://sdk.vercel.ai/providers/ai-sdk-providers/google-vertex",
    model: "gemini-2.0-flash-exp",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "GOOGLE_VERTEX_API_KEY",
  },
  {
    provider: "Google Vertex",
    providerUrl:
      "https://sdk.vercel.ai/providers/ai-sdk-providers/google-vertex",
    model: "gemini-1.5-flash",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "GOOGLE_VERTEX_API_KEY",
  },
  {
    provider: "Google Vertex",
    providerUrl:
      "https://sdk.vercel.ai/providers/ai-sdk-providers/google-vertex",
    model: "gemini-1.5-pro",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "GOOGLE_VERTEX_API_KEY",
  },
  {
    provider: "DeepSeek",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/deepseek",
    model: "deepseek-chat",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "DEEPSEEK_API_KEY",
  },
  {
    provider: "DeepSeek",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/deepseek",
    model: "deepseek-reasoner",
    imageInput: false,
    objectGeneration: false,
    toolUsage: false,
    toolStreaming: false,
    apiKey: "DEEPSEEK_API_KEY",
  },
  {
    provider: "Cerebras",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/cerebras",
    model: "llama3.1-8b",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "CEREBRAS_API_KEY",
  },
  {
    provider: "Cerebras",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/cerebras",
    model: "llama3.1-70b",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "CEREBRAS_API_KEY",
  },
  {
    provider: "Cerebras",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/cerebras",
    model: "llama3.3-70b",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "CEREBRAS_API_KEY",
  },
  {
    provider: "Groq",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/groq",
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "GROQ_API_KEY",
  },
  {
    provider: "Groq",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/groq",
    model: "llama-3.3-70b-versatile",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "GROQ_API_KEY",
  },
  {
    provider: "Groq",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/groq",
    model: "llama-3.1-8b-instant",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "GROQ_API_KEY",
  },
  {
    provider: "Groq",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/groq",
    model: "mixtral-8x7b-32768",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "GROQ_API_KEY",
  },
  {
    provider: "Groq",
    providerUrl: "https://sdk.vercel.ai/providers/ai-sdk-providers/groq",
    model: "gemma2-9b-it",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: "GROQ_API_KEY",
  },
];

export function ProviderTable() {
  return (
    <Table className="my-10">
      <TableCaption>AI Model Capabilities by Provider</TableCaption>
      <TableHeader>
        <TableRow className="dark:border-neutral-700 border-[var(--light-border-muted)]">
          <TableHead className="w-[200px] font-bold pb-2">Provider</TableHead>
          <TableHead className="w-[200px] font-bold pb-2">
            Provider String
          </TableHead>
          <TableHead className="w-[200px] font-bold pb-2">Env var</TableHead>
          <TableHead className="w-[250px] font-bold pb-2">Model</TableHead>
          <TableHead className="pb-2 font-bold text-center">
            Image Input
          </TableHead>
          <TableHead className="pb-2 font-bold text-center">
            Object Generation
          </TableHead>
          <TableHead className="pb-2 font-bold text-center">
            Tool Usage
          </TableHead>
          <TableHead className="pb-2 font-bold text-center">
            Tool Streaming
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {modelData.map((model, index) => (
          <TableRow
            className="dark:border-neutral-700 border-[var(--light-border-muted)]"
            key={index}
          >
            <TableCell className="font-medium">
              <Link
                href={model.providerUrl}
                className="dark:text-green-400  text-[var(--light-green-accent-2)] hover:underline"
              >
                {model.provider}
              </Link>
            </TableCell>
            <TableCell className="font-mono">
              {model.providerUrl.split("/").pop()!.split("-")[0]}
            </TableCell>
            <TableCell className="font-medium">
              <Badge
                className="dark:bg-neutral-900 font-normal bg-[var(--light-color-surface-1)]"
                variant="secondary"
              >
                {model.apiKey}
              </Badge>
            </TableCell>
            <TableCell className="font-medium">
              <Badge
                className="dark:bg-neutral-900 font-mono font-normal max-w-[300px] bg-[var(--light-color-surface-1)]"
                variant="secondary"
              >
                {model.model}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              {model.imageInput ? (
                <Check className="dark:text-green-400 text-[var(--light-green-accent-2)] inline-block w-[18px] h-[18px]" />
              ) : (
                <Cross className="inline-block w-[18px] h-[18px]" />
              )}
            </TableCell>
            <TableCell className="text-center">
              {model.objectGeneration ? (
                <Check className="dark:text-green-400 text-[var(--light-green-accent-2)] inline-block w-[18px] h-[18px]" />
              ) : (
                <Cross className="inline-block w-[18px] h-[18px]" />
              )}
            </TableCell>
            <TableCell className="text-center">
              {model.toolUsage ? (
                <Check className="dark:text-green-400 text-[var(--light-green-accent-2)] inline-block w-[18px] h-[18px]" />
              ) : (
                <Cross className="inline-block w-[18px] h-[18px]" />
              )}
            </TableCell>
            <TableCell className="text-center">
              {model.toolStreaming ? (
                <Check className="dark:text-green-400 text-[var(--light-green-accent-2)] inline-block w-[18px] h-[18px]" />
              ) : (
                <Cross className="inline-block w-[18px] h-[18px]" />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
