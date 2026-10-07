"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { init, use } from "echarts/core";
import type { EChartsType } from "echarts/core";
import { LineChart, BarChart, HeatmapChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  DataZoomComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { DataTable } from "../data-table.tsx";
import type { RendererProps } from "../renderer-props.ts";
import { formatValue, periodLabel } from "../../components/format.ts";
import { chartPoints, chartTheme, eventName } from "./shared.ts";
import { heatmapOptions } from "./heatmap.ts";
import { cartesianOptions } from "./cartesian.ts";
import { CohortSelection } from "./cohort-selection.tsx";

use([
  LineChart,
  BarChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  DataZoomComponent,
  SVGRenderer,
]);

/** Client-only ECharts views draw verified source rows; interactions never create analytical facts. */
export default function Charts(props: RendererProps) {
  const { binding, result, declaration, act } = props;
  const container = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string>();
  const points = chartPoints(props);
  const active = points.find((point) => point.key === selected);
  const update = useEffectEvent(
    (chart: EChartsType, element: HTMLElement, reducedMotion: boolean) => {
      const points = chartPoints(props);
      const theme = chartTheme(props, points, element, reducedMotion);
      const options =
        props.declaration.kind === "heatmap"
          ? heatmapOptions(points, theme)
          : cartesianOptions(props, points, theme);
      chart.setOption(options, { notMerge: true });
    },
  );
  const select = useEffectEvent((event: unknown) => {
    const key = eventName(event);
    if (key && chartPoints(props).some((point) => point.key === key)) setSelected(key);
  });
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const chart = init(element, undefined, {
      renderer: "svg",
      width: element.clientWidth,
      height: element.clientHeight,
    });
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const refresh = () => update(chart, element, motion.matches);
    refresh();
    chart.on("click", select);
    const resize = new ResizeObserver(() => {
      if (element.clientWidth > 0 && element.clientHeight > 0)
        chart.resize({ width: element.clientWidth, height: element.clientHeight });
    });
    resize.observe(element);
    const theme = new MutationObserver(refresh);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    motion.addEventListener("change", refresh);
    return () => {
      resize.disconnect();
      theme.disconnect();
      motion.removeEventListener("change", refresh);
      chart.dispose();
    };
  }, [
    result.resultId,
    binding.properties.x,
    binding.properties.y,
    binding.properties.value,
    declaration.kind,
  ]);
  const matrix = declaration.kind === "heatmap";
  return (
    <div>
      <div
        className="echart"
        style={{
          height: matrix
            ? Math.max(320, new Set(points.map((point) => point.cohort)).size * 30 + 120)
            : 340,
        }}
        role="img"
        aria-label={`${binding.properties.title}, ${result.data.unit === "USD cents" ? "USD" : result.data.unit}; ${periodLabel(result.data)}; ${matrix ? "activation cohorts" : "zero baseline"}`}
      >
        <div ref={container} aria-hidden="true" style={{ height: "100%", width: "100%" }} />
      </div>
      <div
        className="chart-points"
        role="group"
        aria-label={matrix ? "Cohort cells" : "Chart points"}
      >
        {matrix ? (
          <CohortSelection points={points} active={active} setSelected={setSelected} />
        ) : (
          points.map((point) => (
            <button
              key={point.key}
              aria-pressed={selected === point.key}
              onClick={() => setSelected(point.key)}
            >
              {point.label}
            </button>
          ))
        )}
      </div>
      {active && (
        <div className="chart-selection" role="status">
          {active.label}: <strong>{formatValue(active.value, result.data.unit)}</strong>
          {active.denominator !== undefined && (
            <span>
              {" "}
              · {
                result.data.table?.columns.find((column) => column.key === "numerator")?.label
              }:{" "}
              {active.numerator} / {active.denominator}
            </span>
          )}
          {declaration.actions.includes("drill") && (
            <button
              onClick={() => act({ type: "drill", componentId: binding.id, label: active.key })}
            >
              Inspect selected records
            </button>
          )}
        </div>
      )}
      {matrix ? (
        <p>
          Month 0 is the activation month end. Blank cells have not been observed. Cohort size stays
          fixed. After the first complete cancellation, reactivated customers remain outside
          continuous retention.
        </p>
      ) : (
        result.data.unit === "percent" && (
          <p>Months without a denominator are gaps; monthly rates are never added.</p>
        )
      )}
      <DataTable {...props} />
    </div>
  );
}
