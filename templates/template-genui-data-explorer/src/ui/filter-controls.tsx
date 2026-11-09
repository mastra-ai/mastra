"use client";
import { useId, useState } from "react";
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
  const id = useId();
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const [comparison, setComparison] = useState("0");
  const [comparisonDraft, setComparisonDraft] = useState("");
  const options =
    control.options ??
    (control.type === "boolean"
      ? [
          { label: "True", value: true },
          { label: "False", value: false },
        ]
      : undefined);
  const selected = options?.findIndex((option) => option.value === value) ?? -1;
  const parse = (text: string) => {
    if (!text.trim()) return undefined;
    if (control.type !== "number") return text;
    const number = Number(text);
    return Number.isFinite(number) ? number : undefined;
  };
  const filterValue = parse(draft);
  const compareValue = options ? options[Number(comparison)]?.value : parse(comparisonDraft);
  const filter = (next: Scalar | undefined) => {
    void act({
      type: "filter",
      componentId,
      field: control.field,
      ...(next !== undefined ? { value: next } : {}),
    });
  };
  if (!actions.includes("filter") && !actions.includes("compare")) return null;
  return (
    <fieldset className="filter-field" disabled={disabled}>
      <legend>{control.label}</legend>
      {actions.includes("filter") && (
        <div className="filter-row">
          <label htmlFor={`${id}-filter`}>
            Filter
            {options ? (
              <select
                id={`${id}-filter`}
                aria-label={`${control.label} filter ${title}`}
                value={selected < 0 ? "" : String(selected)}
                onChange={(event) =>
                  filter(
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
              <input
                id={`${id}-filter`}
                aria-label={`${control.label} filter ${title}`}
                type={control.type === "number" ? "number" : "text"}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            )}
          </label>
          {!options && (
            <div className="filter-actions">
              <button
                aria-label={`Apply ${control.label} filter`}
                disabled={filterValue === undefined}
                onClick={() => filter(filterValue)}
              >
                Apply
              </button>
              <button
                aria-label={`Clear ${control.label} filter`}
                disabled={value === undefined}
                onClick={() => filter(undefined)}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
      {actions.includes("compare") && (
        <div className="filter-row">
          <label htmlFor={`${id}-compare`}>
            Compare with
            {options ? (
              <select
                id={`${id}-compare`}
                aria-label={`Compare ${control.label} ${title}`}
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
              <input
                id={`${id}-compare`}
                aria-label={`Compare ${control.label} ${title}`}
                type={control.type === "number" ? "number" : "text"}
                value={comparisonDraft}
                onChange={(event) => setComparisonDraft(event.target.value)}
              />
            )}
          </label>
          <div className="filter-actions">
            <button
              aria-label={`Compare ${control.label}`}
              disabled={compareValue === undefined}
              onClick={() => {
                if (compareValue !== undefined)
                  void act({
                    type: "compare",
                    componentId,
                    field: control.field,
                    value: compareValue,
                  });
              }}
            >
              Compare
            </button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
