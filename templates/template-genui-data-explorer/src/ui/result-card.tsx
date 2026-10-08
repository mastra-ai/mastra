"use client";
import { useState, useId } from "react";
import { components } from "../components/catalog.ts";
import type { ComponentDeclaration } from "../components/catalog.ts";
import { drillGrouping, filterControl } from "../../data-sources/source.ts";
import { FilterControls } from "./filter-controls.tsx";
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
      (action) => action !== "drill" || Boolean(drillGrouping(capability, result.data.request)),
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
                .map(
                  ([field, value]) =>
                    `${capability ? filterControl(capability, field).label : field}: ${value}`,
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
        {binding.properties.scenario && <p>Illustrative scenario · outcomes are not guaranteed</p>}
        {result.data.presentation?.note && <p>{result.data.presentation.note}</p>}
        <RegisteredView
          binding={titled}
          result={result}
          declaration={entry}
          act={(action) => {
            void act(action);
          }}
        />
        <footer className="card-footer">
          <div className="card-actions">
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
          </div>
          {capability?.fields.includes("filters") &&
            capability.filters.length > 0 &&
            entry.actions.some((action) => action === "filter" || action === "compare") && (
              <details className="card-filters">
                <summary>Filters and comparisons</summary>
                <div className="filter-grid">
                  {capability.filters.map((field) => (
                    <FilterControls
                      key={`${result.resultId}:${field}`}
                      control={filterControl(capability, field)}
                      value={result.data.request.filters?.[field]}
                      componentId={binding.id}
                      title={title}
                      actions={entry.actions}
                      disabled={isRunning}
                      act={act}
                    />
                  ))}
                </div>
              </details>
            )}
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
        </footer>
      </div>
    </article>
  );
}
