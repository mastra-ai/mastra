import { randomUUID } from "node:crypto";

import { SourceError, groupingColumn } from "../../data-sources/source.ts";
import { DataExplorer } from "../analysis/explorer.ts";
import { WorkspaceError, WorkspaceStore } from "./store.ts";
import type { Workspace, WorkspaceAction, WorkspaceSnapshot, Correction } from "./contracts.ts";
import { workspaceId, threadId, overviewFor, savedCardTurn } from "./contracts.ts";
import { validateCatalog } from "../components/catalog.ts";
import { validateComposition } from "../analysis/composition.ts";
import type { ComponentDeclaration, ComponentBinding } from "../components/catalog.ts";

import type { Session } from "../analysis/workflow.ts";
import type { Question } from "../analysis/contracts.ts";
import { humanAnswer } from "../components/format.ts";

export class WorkspaceEngine {
  readonly explorer: DataExplorer;
  readonly store: WorkspaceStore;
  readonly catalog: readonly ComponentDeclaration[];
  readonly #active = new Map<
    string,
    { requestId: string; controller: AbortController; completion: Promise<void> }
  >();
  constructor(
    explorer: DataExplorer,
    store: WorkspaceStore,
    entries: readonly ComponentDeclaration[],
  ) {
    this.explorer = explorer;
    this.store = store;
    this.catalog = validateCatalog(entries);
    this.store.registerLegacy(workspaceId, threadId);
  }
  sessionForThread(id: string) {
    return this.store.sessionForThread(id);
  }
  createSession(): WorkspaceSnapshot {
    const id = randomUUID();
    this.store.createSession({
      id,
      threadId: `chat-${id}`,
      revision: 0,
      source: this.explorer.describe(),
      results: [],
      components: [],
      filters: {},
      messages: [],
    });
    return this.snapshot(id);
  }
  cancel(requestId: string, id = workspaceId) {
    const active = this.#active.get(id);
    if (active?.requestId === requestId)
      active.controller.abort(
        new SourceError("cancelled", "Analysis cancelled. The last saved workspace is preserved."),
      );
  }
  snapshot(id = workspaceId): WorkspaceSnapshot {
    const session = this.store.session(id);
    const sessions = this.store.sessions();
    const workspaceId = session.id,
      threadId = session.threadId;
    const source = this.explorer.describe();
    const catalog = this.catalog.map(({ id, version, defaults }) => ({ id, version, defaults }));
    const workspace = this.store.load(workspaceId) ?? {
      id: workspaceId,
      threadId,
      revision: 0,
      source,
      results: [],
      components: [],
      filters: {},
      messages: [],
    };
    if (workspace.id !== session.id || workspace.threadId !== session.threadId)
      throw new WorkspaceError(
        "recovery-required",
        "Saved chat identity is inconsistent. Restore a compatible local store.",
      );
    workspace.messages = workspace.messages.map((message) => {
      if (message.role !== "assistant") return message;
      const results = workspace.results.filter(
        (result) => `${result.requestId}-answer` === message.id,
      );
      return results.length
        ? { ...message, content: results.map((result) => humanAnswer(result.data)).join("\n") }
        : message;
    });
    const savedSource = workspace.source;
    if (
      ["id", "version", "datasetVersion", "metricVersion"].some(
        (key) => Reflect.get(savedSource, key) !== Reflect.get(source, key),
      )
    )
      return {
        sessions,
        catalog,
        workspace,
        status: "recovery-required",
        message:
          "Saved data/source versions changed. Restore the matching dataset or start a separate workspace; saved facts have not been rebound.",
      };
    let recovered = false;
    workspace.source = source;
    const components = workspace.components
      .map((binding) => {
        try {
          validateComposition({ components: [binding] }, workspace.results, this.catalog);
          return binding;
        } catch {
          recovered = true;
          const fallback = this.catalog.find((entry) => entry.kind === "table");
          if (!fallback) return undefined;
          const table: ComponentBinding = {
            ...binding,
            component: fallback.id,
            version: fallback.version,
            properties: {
              title: `${binding.properties.title} (table recovery)`,
              ...(binding.properties.scenario ? { scenario: true } : {}),
            },
          };
          try {
            validateComposition({ components: [table] }, workspace.results, this.catalog);
            return table;
          } catch {
            return undefined;
          }
        }
      })
      .filter((binding) => binding !== undefined);
    const latest = this.store.latest(workspaceId);
    if (latest && latest.status !== "complete")
      return {
        sessions,
        catalog,
        workspace: { ...workspace, components },
        ...(latest.question
          ? { lastRequest: { question: latest.question, requestId: latest.requestId } }
          : {}),
        status:
          latest.status === "running" && this.#active.has(workspaceId) ? "working" : "incomplete",
        message:
          latest.message ??
          "The last request was interrupted before saving. The last complete revision is shown. Explicitly retry with a new request ID.",
      };
    return {
      sessions,
      catalog,
      workspace: { ...workspace, components },
      status: "saved",
      message: recovered
        ? "A saved renderer changed. Verified table recovery is shown where available; unavailable cards require the original configuration."
        : `Saved revision ${workspace.revision}.`,
    };
  }
  validateAction(
    action: Exclude<WorkspaceAction, { type: "dismiss" | "back" }>,
    workspace: Workspace,
  ) {
    const binding = workspace.components.find((component) => component.id === action.componentId);
    const entry =
      binding &&
      this.catalog.find(
        (item) => item.id === binding.component && item.version === binding.version,
      );
    const result = binding && workspace.results.find((item) => item.resultId === binding.resultId);
    if (!binding || !entry || !result || !entry.actions.includes(action.type))
      throw new WorkspaceError(
        "invalid-input",
        "The component or action is unavailable in the enabled catalog.",
      );
    const request = structuredClone(result.data.request);
    const filters = { ...workspace.filters };
    if (action.type === "filter") {
      if (action.value === undefined) delete filters[action.field];
      else filters[action.field] = action.value;
      request.filters = filters;
    } else if (action.type === "compare")
      request.filters = { ...request.filters, segment: action.segment };
    else {
      const group = request.groupBy;
      const table = result.data.table;
      const column = table && groupingColumn(table);
      if (!group || !column || !table?.rows.some((row) => row[column.key] === action.label))
        throw new WorkspaceError("invalid-input", "Drill into a verified category or month.");
      if (group === "month") {
        const start = `${action.label.slice(0, 7)}-01`;
        const date = new Date(`${start}T00:00:00Z`);
        date.setUTCMonth(date.getUTCMonth() + 1);
        if (!request.period)
          throw new WorkspaceError("invalid-input", "A period is required for monthly drill-down.");
        request.period = {
          start: start < request.period.start ? request.period.start : start,
          end:
            date.toISOString().slice(0, 10) > request.period.end
              ? request.period.end
              : date.toISOString().slice(0, 10),
        };
      } else
        request.filters = {
          ...request.filters,
          [group]: group === "ownerId" ? Number(action.label) : action.label,
        };
      delete request.groupBy;
      request.records = true;
    }
    return { request, filters, binding, result };
  }
  requestPayload(question: Question, action?: WorkspaceAction, correction?: Correction) {
    return JSON.stringify({
      question: question.question,
      baseRevision: question.baseRevision,
      action: action ?? undefined,
      correction,
    });
  }
  repeated(question: Question, action?: WorkspaceAction, correction?: Correction) {
    return this.store.request(
      question.workspaceId,
      question.requestId,
      this.requestPayload(question, action, correction),
    );
  }
  async synchronizeConversation(workspace: Workspace) {
    const threadId = workspace.threadId;
    const memory = await this.explorer.agent.getMemory();
    if (!memory) return;
    await memory.deleteThread(threadId);
    await memory.createThread({
      threadId,
      resourceId: "local-demo-user",
      title: "Local verified exploration",
    });
    if (workspace.messages.length)
      await memory.saveMessages({
        messages: workspace.messages.map((message, index) => ({
          ...message,
          id: `${workspace.id}:${message.id}`,
          threadId,
          resourceId: "local-demo-user",
          createdAt: new Date(index),
          content: {
            format: 2 as const,
            parts: [{ type: "text" as const, text: message.content }],
            content: message.content,
          },
        })),
      });
  }
  async run(
    question: Question,
    controller: AbortController,
    execute: NonNullable<NonNullable<Parameters<DataExplorer["analyze"]>[1]>["execute"]>,
    action?: WorkspaceAction,
    onCommit?: (workspace: Workspace) => void,
    correction?: Correction,
  ) {
    const { workspaceId, threadId } = question;
    const initial = this.snapshot(workspaceId);
    if (initial.status === "recovery-required")
      throw new WorkspaceError("recovery-required", initial.message);
    if (question.threadId !== initial.workspace.threadId)
      throw new WorkspaceError("invalid-input", "Select a saved chat with its matching thread.");
    const payload = this.requestPayload(question, action, correction);
    const duplicate = this.store.request(workspaceId, question.requestId, payload);
    if (duplicate) {
      if (duplicate.status === "running")
        throw new WorkspaceError(
          "invalid-input",
          "This request is running or was interrupted. Reload and explicitly retry with a new request ID.",
        );
      return { duplicate: true, snapshot: this.snapshot(workspaceId), outcome: duplicate.response };
    }
    /* Preserve accepted bindings during display-only catalog recovery. */
    const canonical = this.store.load(workspaceId) ?? initial.workspace;
    if (question.baseRevision !== initial.workspace.revision)
      throw new WorkspaceError(
        "stale-revision",
        "This request used an older revision. Reload the saved workspace and retry.",
      );
    if (
      correction &&
      (action || !initial.workspace.components.some((item) => item.id === correction.componentId))
    )
      throw new WorkspaceError(
        "invalid-input",
        "Correct an existing accepted view with a new question and reason.",
      );
    if (
      (action?.type === "dismiss" || action?.type === "back") &&
      !canonical.components.some((item) => item.id === action.componentId)
    )
      throw new WorkspaceError("invalid-input", "This view is no longer available.");
    const previousView =
      action?.type === "back" ? overviewFor(canonical, action.componentId) : undefined;
    if (action?.type === "back") {
      if (!previousView || previousView.binding.id !== action.componentId)
        throw new WorkspaceError("invalid-input", "No saved overview is available for this view.");
      try {
        validateComposition(
          { components: [previousView.binding] },
          [previousView.result],
          this.catalog,
        );
      } catch {
        throw new WorkspaceError(
          "invalid-input",
          "Restore the overview's registered component before returning to it.",
        );
      }
    }
    const interaction =
      action && action.type !== "dismiss" && action.type !== "back"
        ? this.validateAction(action, initial.workspace)
        : undefined;
    const previous = this.#active.get(workspaceId);
    if (previous) {
      previous.controller.abort(new SourceError("cancelled", "Superseded by a newer interaction."));
      await previous.completion;
    }
    controller.signal.throwIfAborted();
    this.store.begin(workspaceId, question.requestId, payload);
    this.explorer.telemetry?.record({
      type: "source-selected",
      requestId: question.requestId,
      workspaceId,
      threadId,
      sourceId: initial.workspace.source.id,
      datasetVersion: initial.workspace.source.datasetVersion,
    });
    if (action)
      this.explorer.telemetry?.record({
        type: "interaction",
        requestId: question.requestId,
        workspaceId,
        threadId,
        status: action.type,
      });
    let release!: () => void;
    const completion = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.#active.set(workspaceId, { requestId: question.requestId, controller, completion });
    let committed: Workspace | undefined;
    try {
      if (action?.type === "dismiss" || action?.type === "back") {
        const components = previousView
          ? canonical.components.map((item) =>
              item.id === action.componentId ? previousView.binding : item,
            )
          : canonical.components.filter((item) => item.id !== action.componentId);
        const drillBack = new Map(Object.entries(canonical.drillBack ?? {}));
        drillBack.delete(action.componentId);
        const next: Workspace = {
          ...canonical,
          revision: question.baseRevision + 1,
          components,
          messages: initial.workspace.messages,
          results: [
            ...canonical.results.filter(
              (result) => result.resultId !== previousView?.result.resultId,
            ),
            ...(previousView ? [previousView.result] : []),
          ].filter((result) => components.some((item) => item.resultId === result.resultId)),
          cardTurns: Object.fromEntries(
            Object.entries(canonical.cardTurns ?? {}).filter(
              ([id]) => previousView || id !== action.componentId,
            ),
          ),
          drillBack: Object.fromEntries(drillBack),
          filters: previousView ? previousView.filters : components.length ? canonical.filters : {},
        };
        this.store.commit(question.baseRevision, next, question.requestId, {
          status: "complete",
          revision: next.revision,
        });
        committed = next;
        return {
          duplicate: false,
          snapshot: this.snapshot(workspaceId),
          outcome: {
            status: "complete",
            message: previousView ? "Overview restored." : "View removed.",
          },
        };
      }
      await this.synchronizeConversation(canonical);
      const outcome = await this.explorer.analyze(question, {
        ...(correction ? { correctionComponentId: correction.componentId } : {}),
        ...(!interaction
          ? {
              accepted: {
                components: initial.workspace.components,
                results: initial.workspace.results,
              },
            }
          : {}),
        signal: controller.signal,
        filters: interaction ? interaction.request.filters : initial.workspace.filters,
        execute: interaction
          ? async (context, session) => {
              const run = await this.explorer.workflow.createRun({
                runId: randomUUID(),
                shouldPersistSnapshot: () => false,
              });
              session.workflowRunId = run.runId;
              const output = await run.start({
                inputData: interaction.request,
                requestContext: context,
              });
              if (output.status !== "success")
                throw (
                  session.failure ??
                  new SourceError("invalid-result", "The interaction did not complete.")
                );
              const result = output.result;
              const component =
                action?.type === "drill"
                  ? this.catalog.find((entry) => entry.kind === "table")
                  : this.catalog.find((entry) => entry.id === interaction.binding.component);
              if (!component)
                throw new SourceError(
                  "invalid-composition",
                  "Enable a compatible component for this interaction.",
                );
              session.composition = validateComposition(
                {
                  components: [
                    {
                      ...interaction.binding,
                      id:
                        action?.type === "compare"
                          ? `${interaction.binding.id}-${question.requestId}`
                          : interaction.binding.id,
                      component: component.id,
                      version: component.version,
                      resultId: result.resultId,
                      properties:
                        action?.type === "drill"
                          ? { title: "Opportunity records" }
                          : {
                              ...interaction.binding.properties,
                              title:
                                action?.type === "compare"
                                  ? `Comparison: ${action.segment}`
                                  : interaction.binding.properties.title,
                            },
                    },
                  ],
                },
                session.results,
                this.catalog,
              );
              return { finishReason: "stop" };
            }
          : execute,
        onComplete: async (session: Session) => {
          if (!session.composition)
            throw new SourceError(
              "invalid-composition",
              "No validated UI composition was selected. Ask for a supported view and retry.",
            );
          controller.signal.throwIfAborted();
          if (
            correction &&
            (session.composition.components.length !== 1 ||
              session.composition.components[0]?.id !== correction.componentId)
          )
            throw new SourceError(
              "invalid-composition",
              "The correction must replace only its referenced accepted view.",
            );
          const replacements = new Map(
            session.composition.components.map((component) => [component.id, component]),
          );
          const components = [
            ...canonical.components.map((component) => replacements.get(component.id) ?? component),
            ...session.composition.components.filter(
              (component) => !canonical.components.some((existing) => existing.id === component.id),
            ),
          ];
          const results = [...initial.workspace.results, ...session.results].filter((result) =>
            components.some((component) => component.resultId === result.resultId),
          );
          if (components.length > 24)
            throw new SourceError(
              "budget-exceeded",
              "This workspace has reached 24 cards. Refine an existing view with a follow-up question.",
            );
          const drillBack = new Map(Object.entries(canonical.drillBack ?? {}));
          if (!interaction)
            for (const binding of session.composition.components) drillBack.delete(binding.id);
          if (action?.type === "drill" && interaction)
            drillBack.set(action.componentId, {
              binding: interaction.binding,
              result: interaction.result,
              filters: canonical.filters,
            });
          const next: Workspace = {
            ...initial.workspace,
            revision: question.baseRevision + 1,
            ...(correction
              ? {
                  corrections: [
                    ...(initial.workspace.corrections ?? []),
                    { ...correction, requestId: question.requestId },
                  ],
                }
              : {}),
            source: this.explorer.describe(),
            components,
            results,
            drillBack: Object.fromEntries(drillBack),
            cardTurns: Object.fromEntries(
              components.map((component) => {
                return [component.id, savedCardTurn(canonical, component.id) ?? question.requestId];
              }),
            ),
            filters: interaction?.filters ?? initial.workspace.filters,
            ...(action?.type === "drill" ? { drill: action.label } : {}),
            messages: [
              ...initial.workspace.messages,
              { id: question.requestId, role: "user" as const, content: question.question },
              {
                id: `${question.requestId}-answer`,
                role: "assistant" as const,
                content: session.results.map((result) => humanAnswer(result.data)).join("\n"),
              },
            ].slice(-40),
          };
          if (Buffer.byteLength(JSON.stringify(next)) > 1024 * 1024)
            throw new SourceError(
              "budget-exceeded",
              "The saved workspace exceeds 1 MiB. Refine existing cards or request fewer records.",
            );
          try {
            this.store.commit(question.baseRevision, next, question.requestId, {
              status: "complete",
              revision: next.revision,
            });
          } catch (error) {
            committed = undefined;
            if (error instanceof WorkspaceError) throw new SourceError(error.code, error.message);
            throw error;
          }
          committed = next;
          for (const binding of session.composition.components)
            this.explorer.telemetry?.record({
              type: "composition-committed",
              requestId: question.requestId,
              workspaceId,
              threadId,
              traceId: session.traceId,
              resultId: binding.resultId,
              revision: next.revision,
              component: binding.component,
            });
          if (correction)
            this.explorer.telemetry?.record({
              type: "correction-accepted",
              requestId: question.requestId,
              workspaceId,
              threadId,
              traceId: session.traceId,
              revision: next.revision,
            });
          try {
            onCommit?.(next);
          } catch {
            /* A disconnected view cannot undo an accepted transaction. */
          }
        },
      });
      if (!committed) {
        try {
          this.store.finish(workspaceId, question.requestId, outcome);
        } catch {
          /* The visible outcome remains unsaved even if the journal cannot be updated. */
        }
      }
      return { duplicate: false, snapshot: this.snapshot(workspaceId), outcome };
    } finally {
      try {
        await this.synchronizeConversation(this.store.load(workspaceId) ?? canonical);
      } catch {
        /* Canonical workspace remains authoritative; the next request repairs memory before generation. */
      }
      if (this.#active.get(workspaceId)?.controller === controller)
        this.#active.delete(workspaceId);
      release();
    }
  }
  acknowledgeRender(
    input: { revision: number; resultId: string; componentId: string },
    id = workspaceId,
  ) {
    const snapshot = this.snapshot(id);
    const { id: workspaceId, threadId } = snapshot.workspace;
    const binding = snapshot.workspace.components.find(
      (item) => item.id === input.componentId && item.resultId === input.resultId,
    );
    const result = snapshot.workspace.results.find((item) => item.resultId === input.resultId);
    if (
      snapshot.status !== "saved" ||
      snapshot.workspace.revision !== input.revision ||
      !binding ||
      !result ||
      result.data.status !== "available"
    )
      throw new WorkspaceError(
        "invalid-input",
        "Only a current saved verified view can acknowledge rendering.",
      );
    this.explorer.telemetry?.record({
      type: "render-ack",
      requestId: result.requestId,
      workspaceId,
      threadId,
      traceId: result.traceId,
      resultId: result.resultId,
      revision: input.revision,
      component: binding.component,
    });
  }
  close() {
    this.store.close();
    return this.explorer.close();
  }
}
