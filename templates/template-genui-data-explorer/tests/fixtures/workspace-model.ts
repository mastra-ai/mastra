import type { AnalysisRequest } from "../../data-sources/source.ts";
import type { ComponentBinding } from "../../src/ui/catalog.ts";
import { z } from "zod";
import { representationSchema } from "../../src/analysis/contracts.ts";
import { sourceDescriptorSchema } from "../../data-sources/source.ts";
import { acceptedWorkspaceSchema } from "../../src/ui/catalog.ts";
import { randomUUID } from "node:crypto";
import type { MastraModelConfig, LanguageModel } from "@mastra/core/llm";

type Model = Exclude<Extract<MastraModelConfig, { specificationVersion: "v2" }>, LanguageModel>;
type Options = Parameters<Model["doGenerate"]>[0];
function verifiedRepresentation(value: unknown): z.infer<typeof representationSchema> | undefined {
  if (typeof value === "string") {
    try {
      return verifiedRepresentation(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  const parsed = representationSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (!value || typeof value !== "object") return undefined;
  for (const nested of Object.values(value)) {
    const found = verifiedRepresentation(nested);
    if (found) return found;
  }
  return undefined;
}
function serverContext(call: Options) {
  const instructions = call.prompt
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
  const read = (label: string) => {
    const line = instructions.split("\n").find((line) => line.startsWith(`${label}: `));
    if (!line) throw new Error(`Missing ${label}`);
    return JSON.parse(line.slice(label.length + 2));
  };
  return {
    source: sourceDescriptorSchema.parse(read("Source descriptor")),
    accepted: acceptedWorkspaceSchema.parse(read("Accepted workspace context")),
    catalog: z
      .array(
        z.object({
          id: z.string(),
          version: z.string(),
          kind: z.string(),
          roles: z.array(z.string()),
        }),
      )
      .parse(read("Enabled catalog")),
  };
}
/** Prompt routing belongs only to this deterministic provider fixture. Production uses Mastra. */
export function workspaceModel(
  options: {
    choose?: (question: string) => {
      plan?: AnalysisRequest;
      component?: string;
      cardId?: string;
      scenario?: boolean;
    };
    plan?: AnalysisRequest;
    properties?: ComponentBinding["properties"];
    cardId?: string;
    component?: string;
    version?: string;
    delayMs?: number;
    invalid?: boolean;
    schemaDriven?: boolean;
    onCall?: (call: Options) => void;
  } = {},
) {
  const calls: Options[] = [];
  const generate: Model["doGenerate"] = async (call) => {
    calls.push(call);
    options.onCall?.(call);
    const userIndex = call.prompt.findLastIndex((message) => message.role === "user");
    const currentUser = call.prompt[userIndex];
    const user = JSON.stringify(currentUser);
    const selected = options.choose?.(
      typeof currentUser?.content === "string"
        ? currentUser.content
        : Array.isArray(currentUser?.content)
          ? currentUser.content.map((part) => ("text" in part ? part.text : "")).join("\n")
          : "",
    );
    const tools = call.prompt.slice(userIndex + 1).filter((message) => message.role === "tool");
    if (options.delayMs && tools.length === 0 && /slow/i.test(user))
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    const records = /records/i.test(user);
    const ranked = /ranked|segment/i.test(user);
    const context = options.schemaDriven ? serverContext(call) : undefined;
    const metadata = tools.length ? verifiedRepresentation(tools[0]) : undefined;
    const role = metadata?.role ?? (records ? "records" : ranked ? "ranked" : "series");
    const declaration = context?.catalog.find(
      (entry) =>
        entry.kind ===
        (role === "series"
          ? "line"
          : role === "ranked"
            ? "bar"
            : role === "matrix"
              ? "heatmap"
              : "table"),
    );
    const component =
      selected?.component ??
      options.component ??
      declaration?.id ??
      (records ? "table" : ranked ? "bar" : "line");
    const previous = context?.accepted.components.find(
      (binding) => binding.representation.role === role && binding.component === component,
    );
    const correctionLine = call.prompt
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n")
      .split("\n")
      .find((line) => line.startsWith("Correction target: "));
    const correctionTarget = correctionLine
      ? acceptedWorkspaceSchema.shape.components.element.parse(
          JSON.parse(correctionLine.slice("Correction target: ".length)),
        )
      : undefined;
    const capability = context?.source.capabilities.find((capability) =>
      capability.groupings?.some((group) => group.kind === "series"),
    );
    const grouping = capability?.groupings?.find((group) => group.kind === "series");
    if (context && (!capability || !grouping || !declaration || (tools.length > 0 && !metadata)))
      throw new Error(
        "Schema-driven composition requires server capabilities, catalog and verified metadata.",
      );
    let content: Awaited<ReturnType<Model["doGenerate"]>>["content"];
    if (tools.length === 0)
      content = [
        {
          type: "tool-call",
          toolCallId: randomUUID(),
          toolName: "analyze",
          input: JSON.stringify(
            selected?.plan ??
              options.plan ?? {
                metric: context ? capability?.metric : "bookings",
                period: { start: "2025-03-01", end: "2026-04-01" },
                ...(records
                  ? { records: true }
                  : { groupBy: context ? grouping?.field : ranked ? "segment" : "month" }),
              },
          ),
        },
      ];
    else if (tools.length === 1)
      content = [
        {
          type: "tool-call",
          toolCallId: randomUUID(),
          toolName: "compose",
          input: JSON.stringify({
            components: [
              {
                id:
                  correctionTarget?.id ??
                  selected?.cardId ??
                  options.cardId ??
                  (context ? (previous?.id ?? randomUUID()) : `card-${component}`),
                component,
                version: options.version ?? declaration?.version ?? "1",
                resultId: options.invalid ? "forged-result" : metadata?.resultId,
                properties: options.properties ?? {
                  title: context
                    ? "Verified view"
                    : records
                      ? "Closed opportunities"
                      : ranked
                        ? "Bookings by segment"
                        : "Monthly bookings",
                  ...((declaration?.kind ?? component) === "line" ||
                  (declaration?.kind ?? component) === "bar"
                    ? {
                        x: metadata?.grouping,
                        y: metadata?.columns.find(
                          (column) => column.type === "number" && column.unit === metadata.unit,
                        )?.key,
                      }
                    : {}),
                  ...((declaration?.kind ?? component) === "heatmap"
                    ? {
                        x: metadata?.axes?.x,
                        y: metadata?.axes?.y,
                        value: metadata?.axes?.value,
                      }
                    : {}),
                  ...(selected?.scenario ? { scenario: true } : {}),
                  ...(component === "compact" ? { options: { emphasis: "verified" } } : {}),
                },
              },
            ],
          }),
        },
      ];
    else content = [{ type: "text", text: "The verified view is ready." }];
    return {
      content,
      finishReason: tools.length < 2 ? "tool-calls" : "stop",
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      warnings: [],
    };
  };
  const model: Model = {
    specificationVersion: "v2",
    provider: "deterministic",
    modelId: "workspace-proof",
    supportedUrls: {},
    doGenerate: generate,
    doStream: async (call) => {
      const result = await generate(call);
      return {
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            for (const content of result.content) {
              if (content.type === "tool-call") controller.enqueue(content);
              else if (content.type === "text") {
                controller.enqueue({ type: "text-start", id: "answer" });
                controller.enqueue({ type: "text-delta", id: "answer", delta: content.text });
                controller.enqueue({ type: "text-end", id: "answer" });
              }
            }
            controller.enqueue({
              type: "finish",
              finishReason: result.finishReason,
              usage: result.usage,
            });
            controller.close();
          },
        }),
      };
    },
  };
  return { model, calls };
}
