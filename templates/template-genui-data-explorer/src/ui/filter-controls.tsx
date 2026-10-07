"use client";
import { useState } from "react";
import type { FilterControl, Scalar } from "../../data-sources/source.ts";
import type { WorkspaceAction } from "../workspace/contracts.ts";

/** Option indices preserve numeric, boolean and null values across native HTML selects. */
export function FilterControls({
  control,
  value,
  componentId,
  title,
  actions,
  disabled,
  act,
}: {
  control: FilterControl;
  value: Scalar | undefined;
  componentId: string;
  title: string;
  actions: readonly string[];
  disabled: boolean;
  act: (action: WorkspaceAction) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const [comparison, setComparison] = useState("0");
  const options =
    control.options ??
    (control.type === "boolean"
      ? [
          { label: "True", value: true },
          { label: "False", value: false },
        ]
      : undefined);
  const selected = options?.findIndex((option) => option.value === value) ?? -1;
  const parsed = control.type === "number" ? Number(draft) : draft;
  const valid = draft !== "" && (control.type !== "number" || Number.isFinite(parsed));
  const compareValue = options ? options[Number(comparison)]?.value : parsed;
  const send = (type: "filter" | "compare", next: Scalar | undefined) => {
    if (type === "compare") {
      if (next !== undefined) void act({ type, componentId, field: control.field, value: next });
    } else
      void act({
        type,
        componentId,
        field: control.field,
        ...(next !== undefined ? { value: next } : {}),
      });
  };
  return (
    <div className="controls">
      {actions.includes("filter") && (
        <label>
          {control.label} filter
          {options ? (
            <select
              aria-label={`${control.label} filter ${title}`}
              disabled={disabled}
              value={selected < 0 ? "" : String(selected)}
              onChange={(event) =>
                send(
                  "filter",
                  event.target.value === ""
                    ? undefined
                    : options[Number(event.target.value)]?.value,
                )
              }
            >
              <option value="">All</option>
              {options.map((option, index) => (
                <option key={index} value={index}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                aria-label={`${control.label} filter ${title}`}
                type={control.type === "number" ? "number" : "text"}
                disabled={disabled}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button disabled={disabled || !valid} onClick={() => send("filter", parsed)}>
                Apply {control.label} filter
              </button>
              <button
                disabled={disabled || value === undefined}
                onClick={() => send("filter", undefined)}
              >
                Clear {control.label} filter
              </button>
            </>
          )}
        </label>
      )}
      {actions.includes("compare") && (
        <label>
          Compare {control.label}
          {options ? (
            <select
              aria-label={`Compare ${control.label} ${title}`}
              disabled={disabled}
              value={comparison}
              onChange={(event) => setComparison(event.target.value)}
            >
              {options.map((option, index) => (
                <option key={index} value={index}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            !actions.includes("filter") && (
              <input
                aria-label={`Compare ${control.label} ${title}`}
                disabled={disabled}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            )
          )}
          <button
            disabled={disabled || (!options && !valid)}
            onClick={() => send("compare", compareValue)}
          >
            Compare {control.label}
          </button>
        </label>
      )}
    </div>
  );
}
