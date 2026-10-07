import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sourceDescriptorSchema } from "../../data-sources/source.ts";
import { representationSchema } from "../../src/analysis/contracts.ts";

const messageSchema = z.object({ role: z.string(), content: z.unknown().optional() });
const bodySchema = z.object({
  stream: z.boolean().optional(),
  model: z.string(),
  messages: z.array(messageSchema),
  tools: z
    .array(z.object({ function: z.object({ name: z.string(), parameters: z.unknown() }) }))
    .optional(),
});
function metadata(value: unknown): z.infer<typeof representationSchema> | undefined {
  if (typeof value === "string") {
    try {
      return metadata(JSON.parse(value));
    } catch {
      return;
    }
  }
  const parsed = representationSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (value && typeof value === "object")
    for (const part of Object.values(value)) {
      const found = metadata(part);
      if (found) return found;
    }
  return;
}
export function deterministicOpenAI() {
  const calls: { question: string }[] = [];
  const stages: { question: string; tools: number }[] = [];
  const compositionSchemas: unknown[] = [];
  const server = createServer(async (request, response) => {
    try {
      let json = "";
      for await (const chunk of request) json += String(chunk);
      const body = bodySchema.parse(JSON.parse(json));
      const index = body.messages.findLastIndex((item) => item.role === "user");
      const question = String(body.messages[index]?.content);
      const tools = body.messages.slice(index + 1).filter((item) => item.role === "tool");
      const instructions = body.messages
        .filter((item) => item.role === "system")
        .map((item) => String(item.content))
        .join("\n");
      const line = instructions.split("\n").find((line) => line.startsWith("Source descriptor: "));
      if (!line) throw new Error("Missing descriptor.");
      const source = sourceDescriptorSchema.parse(
        JSON.parse(line.slice("Source descriptor: ".length)),
      );
      if (!source.coverage || !source.asOf) throw new Error("Missing coverage.");
      const records = /records/i.test(question),
        ranked = /ranked/i.test(question);
      const cohort = /cohort|heatmap/i.test(question);
      const monthlyChurn = !cohort && /churn/i.test(question);
      const component = records ? "table" : cohort ? "heatmap" : ranked ? "bar" : "line";
      if (tools.length === 1)
        compositionSchemas.push(
          body.tools?.find((tool) => tool.function.name === "compose")?.function.parameters,
        );
      const start = new Date(`${source.coverage.end}T00:00:00Z`);
      start.setUTCMonth(start.getUTCMonth() - 12);
      const period = /last 12 complete months/i.test(question)
        ? { start: start.toISOString().slice(0, 10), end: source.coverage.end }
        : source.coverage;
      const content =
        tools.length === 0
          ? {
              name: "analyze",
              arguments: JSON.stringify({
                // Real OpenAI strict outputs include unused optional fields as null.
                baseline: null,
                horizon: null,
                asOf: null,
                filters: /SMB/.test(question)
                  ? { ownerId: null, segment: "SMB", region: null, stage: null }
                  : null,
                groupBy: records ? null : cohort ? "cohort" : ranked ? "segment" : "month",
                records: records ? true : null,
                metric: cohort
                  ? /churn/i.test(question)
                    ? "cohortChurn"
                    : "cohortRetention"
                  : monthlyChurn
                    ? "customerChurn"
                    : "bookings",
                period: records
                  ? { start: source.asOf.slice(0, 7) + "-01", end: source.coverage.end }
                  : period,
              }),
            }
          : tools.length === 1
            ? {
                name: "compose",
                arguments: JSON.stringify({
                  components: [
                    {
                      id: `standalone-${component}`,
                      component,
                      version: "1",
                      resultId: metadata(tools[0]?.content)?.resultId,
                      properties: {
                        scenario: null,
                        options: null,
                        title: records
                          ? "Opportunity records"
                          : ranked
                            ? "Ranked Sales"
                            : "Monthly Sales",
                        ...(records
                          ? {}
                          : cohort
                            ? {
                                x: metadata(tools[0]?.content)?.axes?.x,
                                y: metadata(tools[0]?.content)?.axes?.y,
                                value: metadata(tools[0]?.content)?.axes?.value,
                              }
                            : { x: metadata(tools[0]?.content)?.grouping, y: "value" }),
                      },
                    },
                  ],
                }),
              }
            : undefined;
      if (tools.length === 0) calls.push({ question });
      stages.push({ question, tools: tools.length });
      if (/cancel/i.test(question) && tools.length === 1)
        await new Promise((resolve) => setTimeout(resolve, 3000));
      const id = randomUUID();
      const completion = {
        id,
        object: "chat.completion",
        created: 1,
        model: body.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: content ? null : "Verified view prepared.",
              ...(content
                ? { tool_calls: [{ id: randomUUID(), type: "function", function: content }] }
                : {}),
            },
            finish_reason: content ? "tool_calls" : "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      };
      if (!body.stream) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(completion));
        return;
      }
      response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      const chunk = (delta: unknown, finish: string | null = null) =>
        response.write(
          `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`,
        );
      chunk({
        role: "assistant",
        ...(content
          ? { tool_calls: [{ index: 0, id: randomUUID(), type: "function", function: content }] }
          : { content: "Verified view prepared." }),
      });
      chunk({}, content ? "tool_calls" : "stop");
      response.write(
        `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: 1, model: body.model, choices: [], usage: completion.usage })}\n\n`,
      );
      response.end("data: [DONE]\n\n");
    } catch {
      response.writeHead(500);
      response.end("Deterministic provider fixture failed.");
    }
  });
  return { server, calls, stages, compositionSchemas };
}
