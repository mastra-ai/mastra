#!/usr/bin/env tsx

interface ModelCapability {
  id: string;
  name: string;
  attachment?: boolean;
  reasoning?: boolean;
  temperature?: boolean;
  tool_call?: boolean;
  modalities?: {
    input: string[];
    output: string[];
  };
  open_weights?: boolean;
}

interface ProviderModels {
  id: string;
  name: string;
  env: string;
  models: Record<string, ModelCapability>;
}

// Popular models to show in the table
const FEATURED_MODELS = [
  // OpenAI
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/o1',
  'openai/o1-mini',

  // Anthropic
  'anthropic/claude-3-5-sonnet-20241022',
  'anthropic/claude-3-5-haiku-20241022',
  'anthropic/claude-3-opus-20240229',

  // Google
  'google/gemini-2.0-flash-thinking-exp-1219',
  'google/gemini-1.5-pro',
  'google/gemini-1.5-flash',

  // DeepSeek
  'deepseek/deepseek-chat',
  'deepseek/deepseek-reasoner',

  // Mistral
  'mistral/mistral-large-latest',
  'mistral/pixtral-large-latest',

  // xAI
  'xai/grok-2-1212',
  'xai/grok-vision-beta',

  // Meta (via Groq)
  'groq/llama-3.3-70b-versatile',
  'groq/llama-3.1-8b-instant',

  // Others
  'cerebras/llama-3.3-70b',
];

async function main() {
  console.log('Fetching models data from models.dev...');

  const response = await fetch('https://models.dev/api.json');
  const modelsData: Record<string, ProviderModels> = await response.json();

  const tableRows: any[] = [];

  for (const modelId of FEATURED_MODELS) {
    const [providerId, ...modelParts] = modelId.split('/');
    const modelName = modelParts.join('/');

    const provider = modelsData[providerId];
    if (!provider || !provider.models[modelName]) {
      console.warn(`Model not found: ${modelId}`);
      continue;
    }

    const model = provider.models[modelName];

    tableRows.push({
      provider: provider.name,
      providerUrl: `/models/providers/${providerId}`,
      model: modelId,
      imageInput: model.modalities?.input?.includes('image') || false,
      objectGeneration: model.tool_call || false,
      toolUsage: model.tool_call || false,
      toolStreaming: model.tool_call || false,
      apiKey: provider.env,
    });
  }

  const tableCode = `import {
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
// Last updated: ${new Date().toISOString().split('T')[0]}
const modelData = ${JSON.stringify(tableRows, null, 2)};

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
`;

  const { writeFile } = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const outputPath = path.join(__dirname, '..', '..', '..', 'docs', 'src', 'components', 'provider-table.tsx');
  await writeFile(outputPath, tableCode);

  console.log(`✅ Generated capabilities table at ${outputPath}`);
}

main().catch(console.error);
