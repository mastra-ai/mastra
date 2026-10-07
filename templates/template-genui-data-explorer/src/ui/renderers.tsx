"use client";
import dynamic from "next/dynamic";
import { components } from "../components/catalog.ts";
import { DataTable } from "./data-table.tsx";
import type { RendererProps } from "./renderer-props.ts";
import { formatValue } from "../components/format.ts";

function Metric({ result }: RendererProps) {
  return <p className="metric-value">{formatValue(result.data.value, result.data.unit)}</p>;
}
const Chart = dynamic(() => import("./charts/chart.tsx"), {
  ssr: false,
  loading: () => <p role="status">Preparing interactive chart…</p>,
});
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
        declaration.kind === "line" || declaration.kind === "bar" || declaration.kind === "heatmap"
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
