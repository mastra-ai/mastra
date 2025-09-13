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

interface ModelCapability {
  id: string;
  name: string;
  imageInput: boolean;
  audioInput: boolean;
  videoInput: boolean;
  toolCall: boolean;
  reasoning: boolean;
  contextWindow: number | null;
  maxOutput: number | null;
  inputCost: number | null;
  outputCost: number | null;
}

interface ProviderModelsTableProps {
  providerId: string;
  models: ModelCapability[];
  totalCount: number;
}

export function ProviderModelsTable({
  providerId,
  models,
  totalCount,
}: ProviderModelsTableProps) {
  const formatTokens = (tokens: number | null) => {
    if (!tokens) return "—";
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    return `${(tokens / 1000).toFixed(0)}K`;
  };

  const formatCost = (cost: number | null) => {
    if (!cost) return "—";
    return `$${cost}`;
  };

  if (models.length === 0) {
    // Fallback for providers without models.dev data
    return (
      <Table className="my-10">
        <TableCaption>
          {totalCount} available model{totalCount !== 1 ? "s" : ""}
        </TableCaption>
        <TableHeader>
          <TableRow className="dark:border-neutral-700 border-[var(--light-border-muted)]">
            <TableHead className="font-bold pb-2">Model ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="dark:border-neutral-700 border-[var(--light-border-muted)]">
            <TableCell className="text-muted-foreground">
              Model capability data not available from models.dev
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <Table className="my-10">
      <TableCaption>
        {models.length < totalCount
          ? `Showing ${models.length} of ${totalCount} available models. All models can be used with \`${providerId}/model-id\` format.`
          : `${totalCount} available model${totalCount !== 1 ? "s" : ""}`}
      </TableCaption>
      <TableHeader>
        <TableRow className="dark:border-neutral-700 border-[var(--light-border-muted)]">
          <TableHead className="w-[250px] font-bold pb-2">Model ID</TableHead>
          <TableHead className="pb-2 font-bold text-center">
            <span className="inline-block" title="Image Input">
              🖼️
            </span>
          </TableHead>
          <TableHead className="pb-2 font-bold text-center">
            <span className="inline-block" title="Audio Input">
              🎤
            </span>
          </TableHead>
          <TableHead className="pb-2 font-bold text-center">
            <span className="inline-block" title="Video Input">
              🎬
            </span>
          </TableHead>
          <TableHead className="pb-2 font-bold text-center">
            <span className="inline-block" title="Tool Calling">
              🔧
            </span>
          </TableHead>
          <TableHead className="pb-2 font-bold text-center">
            <span className="inline-block" title="Reasoning">
              🧠
            </span>
          </TableHead>
          <TableHead className="w-[100px] font-bold pb-2 text-right">
            Context
          </TableHead>
          <TableHead className="w-[100px] font-bold pb-2 text-right">
            Output
          </TableHead>
          <TableHead className="w-[100px] font-bold pb-2 text-right">
            $/1M in
          </TableHead>
          <TableHead className="w-[100px] font-bold pb-2 text-right">
            $/1M out
          </TableHead>
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
                className="dark:bg-neutral-900 font-mono font-normal max-w-[250px] bg-[var(--light-color-surface-1)]"
                variant="secondary"
              >
                {providerId}/{model.id}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              {model.imageInput ? (
                <Check className="dark:text-green-400 text-[var(--light-green-accent-2)] inline-block w-[18px] h-[18px]" />
              ) : (
                <Cross className="inline-block w-[18px] h-[18px] opacity-30" />
              )}
            </TableCell>
            <TableCell className="text-center">
              {model.audioInput ? (
                <Check className="dark:text-green-400 text-[var(--light-green-accent-2)] inline-block w-[18px] h-[18px]" />
              ) : (
                <Cross className="inline-block w-[18px] h-[18px] opacity-30" />
              )}
            </TableCell>
            <TableCell className="text-center">
              {model.videoInput ? (
                <Check className="dark:text-green-400 text-[var(--light-green-accent-2)] inline-block w-[18px] h-[18px]" />
              ) : (
                <Cross className="inline-block w-[18px] h-[18px] opacity-30" />
              )}
            </TableCell>
            <TableCell className="text-center">
              {model.toolCall ? (
                <Check className="dark:text-green-400 text-[var(--light-green-accent-2)] inline-block w-[18px] h-[18px]" />
              ) : (
                <Cross className="inline-block w-[18px] h-[18px] opacity-30" />
              )}
            </TableCell>
            <TableCell className="text-center">
              {model.reasoning ? (
                <Check className="dark:text-green-400 text-[var(--light-green-accent-2)] inline-block w-[18px] h-[18px]" />
              ) : (
                <Cross className="inline-block w-[18px] h-[18px] opacity-30" />
              )}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {formatTokens(model.contextWindow)}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {formatTokens(model.maxOutput)}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {formatCost(model.inputCost)}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {formatCost(model.outputCost)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
