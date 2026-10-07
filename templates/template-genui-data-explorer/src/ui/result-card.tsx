"use client";
import { useState, useId } from "react";
import { components } from "../components/catalog.ts";
import type { ComponentDeclaration } from "../components/catalog.ts";
import { overviewFor } from "../workspace/contracts.ts";
import { RegisteredView } from "./renderers.tsx";
import { periodLabel, viewTitle } from "../components/format.ts";
import { useView } from "./view-context.tsx";

export function ResultCard({ componentId }: { componentId: string }) {
  const { snapshot, act, correct, isRunning } = useView();
  const [collapsed, setCollapsed] = useState(false);
  const bodyId = useId();
  const binding = snapshot.workspace.components.find((item) => item.id === componentId);
  const result = snapshot.workspace.results.find((item) => item.resultId === binding?.resultId);
  const registered = components.find((item) => item.id === binding?.component);
  const configured = snapshot.catalog?.find((item) => item.id === binding?.component);
  if (!binding || !result || !registered)
    return <p role="alert">This saved view is unavailable. Restore its configuration.</p>;
  const capability = snapshot.workspace.source.capabilities.find(
    (item) => item.metric === result.data.metric,
  );
  const entry: ComponentDeclaration = {
    ...registered,
    actions: registered.actions.filter(
      (action) => action !== "drill" || capability?.fields.includes("records"),
    ),
    enabled: true,
    ...(configured ? { defaults: configured.defaults } : {}),
  };
  const title = viewTitle(result.data);
  const titled = { ...binding, properties: { ...binding.properties, title } };
  return (
    <article className="card" data-component={binding.component} data-result={binding.resultId}>
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
          <p className="period">{periodLabel(result.data)}</p>
          {Object.keys(result.data.request.filters ?? {}).length > 0 && (
            <p className="cohort-label">
              {Object.entries(result.data.request.filters ?? {})
                .map(([field, value]) =>
                  field === "ownerId" ? `Sales representative ${value}` : String(value),
                )
                .join(" · ")}
            </p>
          )}
        </div>
        <button
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>
      <div id={bodyId} hidden={collapsed}>
        {binding.properties.scenario && <p>Illustrative scenario · not guaranteed revenue</p>}
        <RegisteredView
          binding={titled}
          result={result}
          declaration={entry}
          act={(action) => {
            void act(action);
          }}
        />
        <div className="controls">
          {overviewFor(snapshot.workspace, binding.id) && (
            <button
              disabled={isRunning}
              onClick={() => {
                void act({ type: "back", componentId: binding.id });
              }}
            >
              Back to overview
            </button>
          )}
          <button
            disabled={isRunning}
            title="Describe a change and apply it to update this view. Source records remain unchanged."
            onClick={() => correct(binding.id, "")}
          >
            Correct this view
          </button>
          {entry.actions.includes("filter") && capability?.filters.includes("segment") && (
            <label>
              Segment filter
              <select
                aria-label={`Segment filter ${title}`}
                disabled={isRunning}
                value={String(result.data.request.filters?.segment ?? "")}
                onChange={(event) => {
                  void act({
                    type: "filter",
                    componentId: binding.id,
                    field: "segment",
                    ...(event.target.value ? { value: event.target.value } : {}),
                  });
                }}
              >
                <option value="">All segments</option>
                <option>SMB</option>
                <option>Mid-market</option>
                <option>Enterprise</option>
              </select>
            </label>
          )}
          {entry.actions.includes("compare") && capability?.filters.includes("segment") && (
            <button
              disabled={isRunning}
              onClick={() => {
                void act({ type: "compare", componentId: binding.id, segment: "Enterprise" });
              }}
            >
              Compare Enterprise
            </button>
          )}
        </div>
        <details className="source-details">
          <summary>Source details</summary>
          <p>{capability?.description}</p>
          <p>Source: {snapshot.workspace.source.title}</p>
          {Object.keys(result.data.request.filters ?? {}).length > 0 && (
            <p>
              {Object.entries(result.data.request.filters ?? {})
                .map(([key, value]) => `${key}: ${value}`)
                .join(" · ")}
            </p>
          )}
        </details>
      </div>
    </article>
  );
}
