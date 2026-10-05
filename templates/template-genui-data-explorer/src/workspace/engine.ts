import { randomUUID } from "node:crypto";

import { SourceError, groupingColumn } from "../../data-sources/source.ts";
import { DataExplorer } from "../analysis/explorer.ts";
import { WorkspaceError, WorkspaceStore } from "./store.ts";
import type { Workspace, WorkspaceAction, WorkspaceSnapshot } from "./contracts.ts";
import { workspaceId, threadId } from "./contracts.ts";
import { validateCatalog, validateComposition } from "../ui/catalog.ts";
import type { ComponentDeclaration, ComponentBinding } from "../ui/catalog.ts";
import type { Session } from "../analysis/workflow.ts";
import type { Question } from "../analysis/contracts.ts";

export class WorkspaceEngine {
  readonly explorer: DataExplorer;
  readonly store: WorkspaceStore;
  readonly catalog: readonly ComponentDeclaration[];
  readonly #active = new Map<string, { controller: AbortController; completion: Promise<void> }>();
  constructor(
    explorer: DataExplorer,
    store: WorkspaceStore,
    entries: readonly ComponentDeclaration[],
  ) {
    this.explorer = explorer;
    this.store = store;
    this.catalog = validateCatalog(entries);
  }
  snapshot(): WorkspaceSnapshot {
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
    const savedSource = workspace.source;
    if (
      ["id", "version", "datasetVersion", "metricVersion"].some(
        (key) => Reflect.get(savedSource, key) !== Reflect.get(source, key),
      )
    )
      return {
        catalog,
        workspace,
        status: "recovery-required",
        message:
          "Saved data/source versions changed. Restore the matching dataset or start a separate workspace; saved facts have not been rebound.",
      };
    let recovered = false;
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
        catalog,
        workspace: { ...workspace, components },
        status:
          latest.status === "running" && this.#active.has(workspaceId) ? "working" : "incomplete",
        message:
          latest.message ??
          "The last request was interrupted before saving. The last complete revision is shown. Explicitly retry with a new request ID.",
      };
    return {
      catalog,
      workspace: { ...workspace, components },
      status: "saved",
      message: recovered
        ? "A saved renderer changed. Verified table recovery is shown where available; unavailable cards require the original configuration."
        : `Saved revision ${workspace.revision}.`,
    };
  }
  validateAction(action: WorkspaceAction, workspace: Workspace) {
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
        const start = action.label;
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
  requestPayload(question: Question, action?: WorkspaceAction) {
    return JSON.stringify({
      question: question.question,
      baseRevision: question.baseRevision,
      action: action ?? undefined,
    });
  }
  repeated(question: Question, action?: WorkspaceAction) {
    return this.store.request(
      workspaceId,
      question.requestId,
      this.requestPayload(question, action),
    );
  }
  async synchronizeConversation(workspace: Workspace) {
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
  ) {
    const initial = this.snapshot();
    if (initial.status === "recovery-required")
      throw new WorkspaceError("recovery-required", initial.message);
    if (question.workspaceId !== workspaceId || question.threadId !== threadId)
      throw new WorkspaceError("invalid-input", "Only the local demo workspace is available.");
    const payload = this.requestPayload(question, action);
    const duplicate = this.store.request(workspaceId, question.requestId, payload);
    if (duplicate) {
      if (duplicate.status === "running")
        throw new WorkspaceError(
          "invalid-input",
          "This request is running or was interrupted. Reload and explicitly retry with a new request ID.",
        );
      return { duplicate: true, snapshot: this.snapshot(), outcome: duplicate.response };
    }
    /* Preserve accepted bindings during display-only catalog recovery. */
    const canonical = this.store.load(workspaceId) ?? initial.workspace;
    if (question.baseRevision !== initial.workspace.revision)
      throw new WorkspaceError(
        "stale-revision",
        "This request used an older revision. Reload the saved workspace and retry.",
      );
    const interaction = action ? this.validateAction(action, initial.workspace) : undefined;
    const previous = this.#active.get(workspaceId);
    if (previous) {
      previous.controller.abort(new SourceError("cancelled", "Superseded by a newer interaction."));
      await previous.completion;
    }
    controller.signal.throwIfAborted();
    this.store.begin(workspaceId, question.requestId, payload);
    let release!: () => void;
    const completion = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.#active.set(workspaceId, { controller, completion });
    let committed: Workspace | undefined;
    try {
      await this.synchronizeConversation(canonical);
      const outcome = await this.explorer.analyze(question, {
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
              "This workspace has reached 24 cards. Reuse a card ID for refinements.",
            );
          const next: Workspace = {
            ...initial.workspace,
            revision: question.baseRevision + 1,
            source: this.explorer.describe(),
            components,
            results,
            filters: interaction?.filters ?? initial.workspace.filters,
            ...(action?.type === "drill" ? { drill: action.label } : {}),
            messages: [
              ...initial.workspace.messages,
              { id: question.requestId, role: "user" as const, content: question.question },
              {
                id: `${question.requestId}-answer`,
                role: "assistant" as const,
                content: session.results.map((result) => result.explanation).join("\n"),
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
      return { duplicate: false, snapshot: this.snapshot(), outcome };
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
  close() {
    this.store.close();
    return this.explorer.close();
  }
}
