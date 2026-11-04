import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { AbstractAgent } from "@ag-ui/client";
import { EventType } from "@ag-ui/core";
import type { BaseEvent, RunAgentInput } from "@ag-ui/core";
import { MastraAgent } from "@ag-ui/mastra";
import { Observable, of } from "rxjs";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { WorkspaceEngine } from "./engine.ts";
import { WorkspaceError } from "./store.ts";
import { requestProperties, workspaceSchema } from "./contracts.ts";

/** Only this guarded agent is registered with the official runtime. Native execution remains guarded. */
export class WorkspaceAgent extends AbstractAgent {
  readonly #controllers = new Set<AbortController>();
  readonly engine: WorkspaceEngine;
  constructor(engine: WorkspaceEngine) {
    super({
      agentId: "dataExplorer",
      description: "Verified local data exploration and persistent registered UI.",
    });
    this.engine = engine;
  }
  override clone() {
    return new WorkspaceAgent(this.engine);
  }
  override abortRun() {
    for (const controller of this.#controllers) controller.abort();
    super.abortRun();
  }
  override run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable((subscriber) => {
      const controller = new AbortController();
      this.#controllers.add(controller);
      const send = (event: BaseEvent) => {
        if (!subscriber.closed && !controller.signal.aborted) subscriber.next(event);
      };
      void (async () => {
        try {
          const { id: workspaceId, threadId } = this.engine.sessionForThread(input.threadId);
          const snapshot = this.engine.snapshot(workspaceId);
          const properties = requestProperties.parse(input.forwardedProps);
          if (
            input.threadId !== threadId ||
            input.tools.length ||
            input.context.length ||
            input.resume?.length ||
            (Object.keys(input.state ?? {}).length > 0 &&
              !isDeepStrictEqual(workspaceSchema.parse(input.state.workspace), snapshot.workspace))
          )
            throw new WorkspaceError(
              "invalid-input",
              "Client state, tools, context and history cannot authorize analytical facts or server operations. Reload the saved workspace.",
            );
          const user = input.messages.at(-1);
          const action = properties.action;
          if (!action && (!user || user.role !== "user" || typeof user.content !== "string"))
            throw new WorkspaceError("invalid-input", "Send one plain-text question.");
          const question = {
            workspaceId,
            threadId,
            requestId: input.runId,
            baseRevision: properties.baseRevision,
            question: action
              ? `Apply ${action.type} to the verified component.`
              : typeof user?.content === "string"
                ? user.content
                : "",
          };
          // A matching journal entry is a replay; fresh history remains server-owned.
          if (
            !action &&
            !this.engine.repeated(question, action, properties.correction) &&
            !isDeepStrictEqual(
              input.messages.slice(0, -1).map(({ id, role, content }) => ({ id, role, content })),
              snapshot.workspace.messages,
            )
          )
            throw new WorkspaceError(
              "invalid-input",
              "Conversation history does not match the saved local thread. Reload before retrying.",
            );
          send({ type: EventType.RUN_STARTED, threadId, runId: input.runId });
          const result = await this.engine.run(
            question,
            controller,
            async (requestContext, session) => {
              const adapter = new MastraAgent({
                agentId: "dataExplorer",
                agent: this.engine.explorer.agent,
                requestContext,
                resourceId: "local-demo-user",
                streamServerToolCalls: true,
              });
              return new Promise<{ finishReason: string }>((resolve, reject) => {
                const cancel = () => adapter.abortRun();
                session.controller.signal.addEventListener("abort", cancel, { once: true });
                adapter
                  .run({
                    threadId,
                    runId: input.runId,
                    messages: [{ id: randomUUID(), role: "user", content: question.question }],
                    state: {},
                    tools: [],
                    context: [],
                    forwardedProps: {},
                  })
                  .subscribe({
                    next: (event) => {
                      // Raw generated text, state and errors cannot masquerade as verified facts.
                      if (event.type.startsWith("TOOL_CALL_")) send(event);
                    },
                    error: () => {
                      session.controller.signal.removeEventListener("abort", cancel);
                      reject(new Error("The model stream failed."));
                    },
                    complete: () => {
                      session.controller.signal.removeEventListener("abort", cancel);
                      resolve({ finishReason: "stop" });
                    },
                  });
              });
            },
            action,
            undefined,
            properties.correction,
          );
          send({ type: EventType.STATE_SNAPSHOT, snapshot: result.snapshot });
          // Failure notices live in workspace status, never in accepted chat history.
          send({ type: EventType.MESSAGES_SNAPSHOT, messages: result.snapshot.workspace.messages });
          send({ type: EventType.RUN_FINISHED, threadId, runId: input.runId });
          subscriber.complete();
        } catch (error) {
          const safe =
            error instanceof WorkspaceError
              ? error
              : new WorkspaceError(
                  "invalid-input",
                  "Invalid workspace request. Reload and retry using the enabled catalog.",
                );
          send({ type: EventType.RUN_ERROR, code: safe.code, message: safe.message });
          subscriber.complete();
        } finally {
          this.#controllers.delete(controller);
        }
      })();
      return () => {
        controller.abort();
        this.#controllers.delete(controller);
      };
    });
  }
}
/** Reconnection hydrates durable accepted state, rather than replaying the runner's volatile history. */
class WorkspaceRunner extends InMemoryAgentRunner {
  readonly engine: WorkspaceEngine;
  constructor(engine: WorkspaceEngine) {
    super({ onConcurrentRun: "supersede", maxThreads: 100, maxRunsPerThread: 20 });
    this.engine = engine;
  }
  override connect(request: Parameters<InMemoryAgentRunner["connect"]>[0]): Observable<BaseEvent> {
    let snapshot;
    try {
      snapshot = this.engine.snapshot(this.engine.sessionForThread(request.threadId).id);
    } catch {
      return of({
        type: EventType.RUN_ERROR,
        code: "invalid-input",
        message: "Select an available saved chat.",
      });
    }
    return of(
      { type: EventType.STATE_SNAPSHOT, snapshot },
      { type: EventType.MESSAGES_SNAPSHOT, messages: snapshot.workspace.messages },
    );
  }
}
export function workspaceRuntime(engine: WorkspaceEngine) {
  const handler = createCopilotRuntimeHandler({
    runtime: new CopilotRuntime({
      agents: { dataExplorer: new WorkspaceAgent(engine) },
      runner: new WorkspaceRunner(engine),
    }),
    basePath: "/copilotkit",
    mode: "multi-route",
    cors: false,
    activateChannels: false,
  });
  return async (request: Request) => {
    // The official in-memory runner intentionally survives detached subscribers.
    // A workspace run instead owns its HTTP lifetime and must stop before saving.
    if (request.method !== "POST" || !new URL(request.url).pathname.endsWith("/run"))
      return handler(request);
    let requestId: string | undefined;
    let sessionId: string | undefined;
    try {
      const body: unknown = await request.clone().json();
      if (body && typeof body === "object" && "runId" in body && typeof body.runId === "string")
        requestId = body.runId;
      if (
        body &&
        typeof body === "object" &&
        "threadId" in body &&
        typeof body.threadId === "string"
      )
        sessionId = engine.sessionForThread(body.threadId).id;
    } catch {
      return handler(request);
    }
    const cancel = () => {
      if (requestId && sessionId) engine.cancel(requestId, sessionId);
    };
    request.signal.addEventListener("abort", cancel, { once: true });
    try {
      const response = await handler(request);
      if (!response.body) {
        request.signal.removeEventListener("abort", cancel);
        return response;
      }
      const reader = response.body.getReader();
      const cleanup = () => {
        request.signal.removeEventListener("abort", cancel);
        reader.releaseLock();
      };
      return new Response(
        new ReadableStream({
          async pull(controller) {
            try {
              const next = await reader.read();
              if (next.done) {
                controller.close();
                cleanup();
              } else controller.enqueue(next.value);
            } catch (error) {
              cancel();
              cleanup();
              controller.error(error);
            }
          },
          async cancel() {
            cancel();
            await reader.cancel();
            cleanup();
          },
        }),
        { status: response.status, statusText: response.statusText, headers: response.headers },
      );
    } catch (error) {
      request.signal.removeEventListener("abort", cancel);
      cancel();
      throw error;
    }
  };
}
