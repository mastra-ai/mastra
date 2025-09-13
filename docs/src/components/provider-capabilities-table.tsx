"use client";

import { useEffect, useState } from "react";
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

interface ProviderCapabilitiesTableProps {
  providerId: string;
  limit?: number;
}

export function ProviderCapabilitiesTable({
  providerId,
  limit = 10,
}: ProviderCapabilitiesTableProps) {
  const [models, setModels] = useState<ModelCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalModels, setTotalModels] = useState(0);

  useEffect(() => {
    async function fetchCapabilities() {
      try {
        const response = await fetch("https://models.dev/api.json");
        const data = await response.json();
        const provider = data[providerId];

        if (!provider?.models) {
          setModels([]);
          setLoading(false);
          return;
        }

        const allModels = Object.entries(provider.models);
        setTotalModels(allModels.length);

        const processedModels = allModels
          .slice(0, limit)
          .map(([modelId, model]: [string, any]) => ({
            id: modelId,
            name: model.name || modelId,
            imageInput: model.modalities?.input?.includes("image") || false,
            audioInput: model.modalities?.input?.includes("audio") || false,
            videoInput: model.modalities?.input?.includes("video") || false,
            toolCall: model.tool_call !== false,
            reasoning: model.reasoning === true,
            contextWindow: model.limit?.context || null,
            maxOutput: model.limit?.output || null,
            inputCost: model.cost?.input || null,
            outputCost: model.cost?.output || null,
          }));

        setModels(processedModels);
        setLoading(false);
      } catch (error) {
        console.error(`Failed to fetch capabilities for ${providerId}:`, error);
        setModels([]);
        setLoading(false);
      }
    }

    fetchCapabilities();
  }, [providerId, limit]);

  if (loading) {
    return (
      <Table className="my-10">
        <TableCaption>Loading model capabilities...</TableCaption>
      </Table>
    );
  }

  if (models.length === 0) {
    return null;
  }

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

  return (
    <Table className="my-10">
      <TableCaption>
        {models.length < totalModels
          ? `Showing ${models.length} of ${totalModels} available models`
          : `${totalModels} available model${totalModels !== 1 ? "s" : ""}`}
      </TableCaption>
      <TableHeader>
        <TableRow className="dark:border-neutral-700 border-[var(--light-border-muted)]">
          <TableHead className="w-[250px] font-bold pb-2">Model</TableHead>
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
                {model.id}
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
