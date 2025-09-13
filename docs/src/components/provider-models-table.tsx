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
import { Badge } from "@/components/ui/badge";

interface ModelData {
  model: string;
  imageInput: boolean;
  objectGeneration: boolean;
  toolUsage: boolean;
  toolStreaming: boolean;
  audioInput?: boolean;
  videoInput?: boolean;
  reasoning?: boolean;
  contextWindow?: number | null;
  maxOutput?: number | null;
  inputCost?: number | null;
  outputCost?: number | null;
}

interface ProviderModelsTableProps {
  models: ModelData[];
  totalCount?: number;
  apiKey?: string;
}

export function ProviderModelsTable({
  models,
  totalCount,
  apiKey,
}: ProviderModelsTableProps) {
  // Get the env var from the first model's provider ID
  const envVar =
    apiKey ||
    (models[0]?.model.includes("/")
      ? `${models[0].model.split("/")[0].toUpperCase().replace(/-/g, "_")}_API_KEY`
      : "API_KEY");

  // Check if we have extended data
  const hasExtendedData = models.some(
    (m) =>
      m.audioInput ||
      m.videoInput ||
      m.reasoning ||
      m.contextWindow ||
      m.inputCost,
  );

  const formatTokens = (tokens: number | null | undefined) => {
    if (!tokens) return "—";
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return `${tokens}`;
  };

  const formatCost = (cost: number | null | undefined) => {
    if (cost === null || cost === undefined) return "—";
    if (cost === 0) return "Free";
    if (cost < 1) return `$${cost.toFixed(2)}`;
    return `$${cost.toFixed(0)}`;
  };

  return (
    <Table className="my-10">
      <TableCaption>
        {totalCount && models.length < totalCount
          ? `Showing ${models.length} of ${totalCount} available models`
          : `${models.length} available model${models.length !== 1 ? "s" : ""}`}
      </TableCaption>
      <TableHeader>
        <TableRow className="dark:border-neutral-700 border-[var(--light-border-muted)]">
          <TableHead className="w-[300px] font-bold pb-2">Model</TableHead>
          <TableHead className="w-[150px] font-bold pb-2">Env var</TableHead>
          <TableHead className="pb-2 font-bold text-center">
            Image Input
          </TableHead>
          {hasExtendedData && (
            <>
              <TableHead className="pb-2 font-bold text-center">
                Audio Input
              </TableHead>
              <TableHead className="pb-2 font-bold text-center">
                Video Input
              </TableHead>
            </>
          )}
          <TableHead className="pb-2 font-bold text-center">
            Object Generation
          </TableHead>
          <TableHead className="pb-2 font-bold text-center">
            Tool Usage
          </TableHead>
          <TableHead className="pb-2 font-bold text-center">
            Tool Streaming
          </TableHead>
          {hasExtendedData && (
            <>
              <TableHead className="pb-2 font-bold text-center">
                Reasoning
              </TableHead>
              <TableHead className="w-[100px] font-bold pb-2 text-right">
                Context
              </TableHead>
              <TableHead className="w-[100px] font-bold pb-2 text-right">
                Max Output
              </TableHead>
              <TableHead className="w-[120px] font-bold pb-2 text-right">
                Input $/1M
              </TableHead>
              <TableHead className="w-[120px] font-bold pb-2 text-right">
                Output $/1M
              </TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {models.map((model, index) => (
          <TableRow
            className="dark:border-neutral-700 border-[var(--light-border-muted)]"
            key={index}
          >
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
                {envVar}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              {model.imageInput ? (
                <Check className="dark:text-green-400 text-[var(--light-green-accent-2)] inline-block w-[18px] h-[18px]" />
              ) : (
                <Cross className="inline-block w-[18px] h-[18px]" />
              )}
            </TableCell>
            {hasExtendedData && (
              <>
                <TableCell className="text-center">
                  {model.audioInput ? (
                    <Check className="dark:text-green-400 text-[var(--light-green-accent-2)] inline-block w-[18px] h-[18px]" />
                  ) : (
                    <Cross className="inline-block w-[18px] h-[18px]" />
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {model.videoInput ? (
                    <Check className="dark:text-green-400 text-[var(--light-green-accent-2)] inline-block w-[18px] h-[18px]" />
                  ) : (
                    <Cross className="inline-block w-[18px] h-[18px]" />
                  )}
                </TableCell>
              </>
            )}
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
            {hasExtendedData && (
              <>
                <TableCell className="text-center">
                  {model.reasoning ? (
                    <Check className="dark:text-green-400 text-[var(--light-green-accent-2)] inline-block w-[18px] h-[18px]" />
                  ) : (
                    <Cross className="inline-block w-[18px] h-[18px]" />
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {formatTokens(model.contextWindow)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {formatTokens(model.maxOutput)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {formatCost(model.inputCost)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {formatCost(model.outputCost)}
                </TableCell>
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
