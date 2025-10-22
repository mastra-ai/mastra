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

// Auto-generated from models.dev data
// Last updated: 2025-09-12
const modelData = [
  {
    provider: "OpenAI",
    providerUrl: "/models/providers/openai",
    model: "openai/gpt-4o",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["OPENAI_API_KEY"],
  },
  {
    provider: "OpenAI",
    providerUrl: "/models/providers/openai",
    model: "openai/gpt-4o-mini",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["OPENAI_API_KEY"],
  },
  {
    provider: "OpenAI",
    providerUrl: "/models/providers/openai",
    model: "openai/o1",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["OPENAI_API_KEY"],
  },
  {
    provider: "OpenAI",
    providerUrl: "/models/providers/openai",
    model: "openai/o1-mini",
    imageInput: false,
    objectGeneration: false,
    toolUsage: false,
    toolStreaming: false,
    apiKey: ["OPENAI_API_KEY"],
  },
  {
    provider: "Anthropic",
    providerUrl: "/models/providers/anthropic",
    model: "anthropic/claude-3-5-sonnet-20241022",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["ANTHROPIC_API_KEY"],
  },
  {
    provider: "Anthropic",
    providerUrl: "/models/providers/anthropic",
    model: "anthropic/claude-3-5-haiku-20241022",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["ANTHROPIC_API_KEY"],
  },
  {
    provider: "Anthropic",
    providerUrl: "/models/providers/anthropic",
    model: "anthropic/claude-3-opus-20240229",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["ANTHROPIC_API_KEY"],
  },
  {
    provider: "Google",
    providerUrl: "/models/providers/google",
    model: "google/gemini-1.5-pro",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["GOOGLE_GENERATIVE_AI_API_KEY"],
  },
  {
    provider: "Google",
    providerUrl: "/models/providers/google",
    model: "google/gemini-1.5-flash",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["GOOGLE_GENERATIVE_AI_API_KEY"],
  },
  {
    provider: "DeepSeek",
    providerUrl: "/models/providers/deepseek",
    model: "deepseek/deepseek-chat",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["DEEPSEEK_API_KEY"],
  },
  {
    provider: "DeepSeek",
    providerUrl: "/models/providers/deepseek",
    model: "deepseek/deepseek-reasoner",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["DEEPSEEK_API_KEY"],
  },
  {
    provider: "Mistral",
    providerUrl: "/models/providers/mistral",
    model: "mistral/mistral-large-latest",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["MISTRAL_API_KEY"],
  },
  {
    provider: "Mistral",
    providerUrl: "/models/providers/mistral",
    model: "mistral/pixtral-large-latest",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["MISTRAL_API_KEY"],
  },
  {
    provider: "xAI",
    providerUrl: "/models/providers/xai",
    model: "xai/grok-2-1212",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["XAI_API_KEY"],
  },
  {
    provider: "xAI",
    providerUrl: "/models/providers/xai",
    model: "xai/grok-vision-beta",
    imageInput: true,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["XAI_API_KEY"],
  },
  {
    provider: "Groq",
    providerUrl: "/models/providers/groq",
    model: "groq/llama-3.3-70b-versatile",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["GROQ_API_KEY"],
  },
  {
    provider: "Groq",
    providerUrl: "/models/providers/groq",
    model: "groq/llama-3.1-8b-instant",
    imageInput: false,
    objectGeneration: true,
    toolUsage: true,
    toolStreaming: true,
    apiKey: ["GROQ_API_KEY"],
  },
];

export function ProviderTable() {
  return (
    <Table className="my-10">
      <TableCaption>AI Model Capabilities by Provider</TableCaption>
      <TableHeader>
        <TableRow className="dark:border-neutral-700 border-[var(--light-border-muted)]">
          <TableHead className="w-[200px] font-bold pb-2">Provider</TableHead>
          <TableHead className="w-[300px] font-bold pb-2">Model</TableHead>
          <TableHead className="w-[150px] font-bold pb-2">Env var</TableHead>
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
            <TableCell className="font-medium">
              <Badge
                className="dark:bg-neutral-900 font-mono font-normal max-w-[300px] bg-[var(--light-color-surface-1)]"
                variant="secondary"
              >
                {model.model}
              </Badge>
            </TableCell>
            <TableCell className="font-medium">
              <Badge
                className="dark:bg-neutral-900 font-normal bg-[var(--light-color-surface-1)]"
                variant="secondary"
              >
                {model.apiKey}
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
