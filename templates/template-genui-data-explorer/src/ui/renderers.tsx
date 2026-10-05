"use client";

import { groupingColumn } from "../../data-sources/source.ts";
import { useState } from "react";
import type { VerifiedResult } from "../analysis/contracts.ts";
import type { ComponentBinding, ComponentDeclaration } from "./catalog.ts";
import { components } from "./catalog.ts";
import type { WorkspaceAction } from "../workspace/contracts.ts";

export interface RendererProps {
  binding: ComponentBinding;
  result: VerifiedResult;
  declaration: ComponentDeclaration;
  act: (action: WorkspaceAction) => void;
}
export function formatValue(value: unknown, unit?: string) {
  if (typeof value !== "number") return String(value ?? "Unavailable");
  if (unit === "USD cents")
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
      value / 100,
    );
  if (unit === "percent") return `${value.toFixed(2)}%`;
  return String(value);
}
export function DataTable({ binding, result, declaration, act }: RendererProps) {
  const [page, setPage] = useState(0);
  const table = result.data.table;
  if (!table) return <p>{formatValue(result.data.value, result.data.unit)}</p>;
  const pageSize = declaration.defaults.pageSize;
  const start = page * pageSize;
  const rows = table.rows.slice(start, start + pageSize);
  const labelColumn = groupingColumn(table);
  const drill =
    declaration.actions.includes("drill") && labelColumn !== undefined && table.kind !== "records";
  return (
    <div className="table-scroll">
      <table>
        <caption>
          Verified {table.kind}; {table.rows.length} rows; {table.omitted} omitted.
        </caption>
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th scope="col" key={column.key}>
                {column.label}
                {column.unit ? ` (${column.unit === "USD cents" ? "USD" : column.unit})` : ""}
              </th>
            ))}
            {drill && <th scope="col">Inspect</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={start + index}>
              {table.columns.map((column) => (
                <td key={column.key}>{formatValue(row[column.key], column.unit)}</td>
              ))}
              {drill && (
                <td>
                  <button
                    onClick={() =>
                      act({
                        type: "drill",
                        componentId: binding.id,
                        label: String(labelColumn && row[labelColumn.key]),
                      })
                    }
                  >
                    Inspect {String(labelColumn && row[labelColumn.key])}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length === 0 && <p>No records in the covered filtered period.</p>}
      <nav aria-label={`${binding.properties.title} table pages`}>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page + 1} of {Math.max(1, Math.ceil(table.rows.length / pageSize))}
        </span>
        <button disabled={start + pageSize >= table.rows.length} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </nav>
    </div>
  );
}
function Metric({ result }: RendererProps) {
  return <p className="metric-value">{formatValue(result.data.value, result.data.unit)}</p>;
}
function Chart(props: RendererProps) {
  const { binding, result, declaration } = props;
  const table = result.data.table;
  const x = binding.properties.x;
  const y = binding.properties.y;
  if (!table || !x || !y) return <DataTable {...props} />;
  const values = table.rows.map((row) => (typeof row[y] === "number" ? row[y] : 0));
  const maximum = Math.max(1, ...values);
  const minimum = Math.min(0, ...values);
  const range = maximum - minimum;
  const dates = table.rows.map((row) => Date.parse(String(row[x])));
  const temporal = declaration.kind === "line" && dates.every(Number.isFinite);
  const firstDate = dates[0] ?? 0,
    lastDate = dates.at(-1) ?? firstDate;
  const points = values.map((value, index) => ({
    x:
      50 +
      500 *
        (temporal
          ? ((dates[index] ?? firstDate) - firstDate) / Math.max(1, lastDate - firstDate)
          : index / Math.max(1, values.length - 1)),
    y: 220 - ((value - minimum) * 180) / range,
    value,
    label: String(table.rows[index]?.[x]),
  }));
  const segments: (typeof points)[] = [];
  for (const point of points) {
    const previous = segments.at(-1)?.at(-1);
    const expected = previous ? new Date(`${previous.label}T00:00:00Z`) : undefined;
    expected?.setUTCMonth(expected.getUTCMonth() + 1);
    if (
      !previous ||
      (result.data.request.groupBy === "month" &&
        expected?.toISOString().slice(0, 10) !== point.label)
    )
      segments.push([]);
    segments.at(-1)!.push(point);
  }
  const zero = 220 - ((0 - minimum) * 180) / range;
  const barWidth = Math.min(60, 450 / Math.max(1, values.length));
  return (
    <div>
      <svg
        role="img"
        aria-label={`${binding.properties.title}, ${result.data.unit}; zero baseline; ${result.data.period?.start} to ${result.data.period?.end} exclusive`}
        viewBox="0 0 620 280"
      >
        <title>{binding.properties.title}</title>
        <desc>
          Values are verified source data. The table below is the keyboard-accessible alternative.{" "}
          {result.data.metric === "forecast"
            ? "Illustrative forecast scenario, not guaranteed revenue."
            : ""}
        </desc>
        <line x1="45" x2="570" y1={zero} y2={zero} stroke="currentColor" />
        <text x="5" y="35">
          {formatValue(maximum, result.data.unit)}
        </text>
        <text x="5" y="238">
          {formatValue(minimum, result.data.unit)}
        </text>
        {declaration.kind === "line"
          ? segments.map((segment, index) => (
              <polyline
                key={index}
                points={segment.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke="var(--chart-color)"
                strokeWidth="3"
                strokeDasharray={binding.properties.scenario ? "5 4" : undefined}
              />
            ))
          : points.map((point) => (
              <rect
                key={point.label}
                x={point.x - barWidth / 2}
                y={Math.min(point.y, zero)}
                width={barWidth}
                height={Math.abs(zero - point.y)}
                fill="var(--chart-color)"
              />
            ))}
        {points.map((point, index) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4" fill="var(--chart-color)">
              <title>
                {point.label}: {formatValue(point.value, result.data.unit)}
              </title>
            </circle>
            {(index % Math.max(1, Math.ceil(points.length / 5)) === 0 ||
              index === points.length - 1) && (
              <text x={point.x} y="264" textAnchor="middle" fontSize="10">
                {table.kind === "series" ? point.label.slice(0, 7) : point.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {result.data.metric === "conversion" && (
        <p>No-close months are gaps; monthly rates are never added.</p>
      )}
      <DataTable {...props} />
    </div>
  );
}
/** An extension renderer with its own validated display option and declared comparison action. */
function CompactMetric({ binding, result }: RendererProps) {
  return (
    <p className="metric-value">
      <strong>{formatValue(result.data.value, result.data.unit)}</strong> ·{" "}
      {String(binding.properties.options?.emphasis ?? "verified")}
    </p>
  );
}
export const renderers = [
  ...components
    .filter((entry) => entry.id !== "compact")
    .map((declaration) => ({
      declaration,
      render:
        declaration.kind === "line" || declaration.kind === "bar"
          ? Chart
          : declaration.kind === "table"
            ? DataTable
            : Metric,
    })),
  { declaration: components.find((entry) => entry.id === "compact")!, render: CompactMetric },
];
export function RegisteredView(props: RendererProps) {
  const renderer = renderers.find((entry) => entry.declaration.id === props.binding.component);
  if (!renderer) return <p role="alert">Renderer unavailable. Restore the registered component.</p>;
  const Renderer = renderer.render;
  return <Renderer {...props} />;
}
