"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { init, use } from "echarts/core";
import type { ComposeOption, EChartsType } from "echarts/core";
import { LineChart, BarChart, HeatmapChart } from "echarts/charts";
import type { LineSeriesOption, BarSeriesOption, HeatmapSeriesOption } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  DataZoomComponent,
} from "echarts/components";
import type {
  GridComponentOption,
  TooltipComponentOption,
  VisualMapComponentOption,
  DataZoomComponentOption,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { DataTable } from "./renderers.tsx";
import type { RendererProps } from "./renderers.tsx";
import { formatDate, formatValue, periodLabel } from "./format.ts";

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
type ChartOption = ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | HeatmapSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | VisualMapComponentOption
  | DataZoomComponentOption
>;
interface Point {
  key: string;
  label: string;
  value: number;
  cohort?: string;
  age?: number;
  denominator?: number;
  numerator?: number;
}
function chartPoints({ binding, result }: RendererProps): Point[] {
  const table = result.data.table;
  if (!table) return [];
  return table.rows.flatMap((row) => {
    const value = row[binding.properties.value ?? binding.properties.y ?? ""];
    if (typeof value !== "number") return [];
    if (table.kind === "matrix" && table.axes) {
      const cohort = String(row[table.axes.y]);
      const age = Number(row[table.axes.x]);
      return [
        {
          key: `${cohort}:${age}`,
          label: `${formatDate(cohort, true)} · Month ${age}`,
          value,
          cohort,
          age,
          numerator: Number(row.numerator),
          denominator: Number(row.denominator),
        },
      ];
    }
    const key = String(row[binding.properties.x ?? ""]);
    return [{ key, label: formatDate(key, table.kind === "series"), value }];
  });
}
function eventName(event: unknown) {
  return event && typeof event === "object" && "name" in event && typeof event.name === "string"
    ? event.name
    : undefined;
}
function monthLabels(props: RendererProps, points: readonly Point[]) {
  const period = props.result.data.period;
  if (props.result.data.request.groupBy !== "month" || !period)
    return points.map((point) => point.key);
  const labels: string[] = [];
  const cursor = new Date(`${period.start.slice(0, 7)}-01T00:00:00Z`);
  while (cursor.toISOString().slice(0, 10) < period.end) {
    const month = cursor.toISOString().slice(0, 10);
    const observations = points.filter((point) => point.key.slice(0, 7) === month.slice(0, 7));
    labels.push(...(observations.length ? observations.map((point) => point.key) : [month]));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return [...new Set([...labels, ...points.map((point) => point.key)])].toSorted();
}
function options(
  props: RendererProps,
  points: readonly Point[],
  container: HTMLElement,
  reducedMotion: boolean,
): ChartOption {
  const style = getComputedStyle(container);
  const color = style.getPropertyValue("--chart-color").trim();
  const ink = style.getPropertyValue("--ink").trim();
  const edge = style.getPropertyValue("--edge").trim();
  const surface = style.getPropertyValue("--surface").trim();
  const lowColor = style.getPropertyValue("--chart-low").trim();
  const pointMap = new Map(points.map((point) => [point.key, point]));
  const numeratorLabel =
    props.result.data.table?.columns.find((column) => column.key === "numerator")?.label ??
    "Numerator";
  const denominatorLabel =
    props.result.data.table?.columns.find((column) => column.key === "denominator")?.label ??
    "Denominator";
  const tooltip: TooltipComponentOption = {
    trigger: "item",
    renderMode: "richText",
    confine: true,
    backgroundColor: surface,
    borderColor: edge,
    textStyle: { color: ink },
    formatter: (event: unknown) => {
      const point = pointMap.get(eventName(event) ?? "");
      if (!point) return "";
      return `${point.label}\n${formatValue(point.value, props.result.data.unit)}${point.denominator === undefined ? "" : `\n${numeratorLabel}: ${point.numerator}\n${denominatorLabel}: ${point.denominator}`}`;
    },
  };
  const base: ChartOption = {
    animation: !reducedMotion,
    animationDuration: 500,
    animationDurationUpdate: 300,
    textStyle: { color: ink, fontFamily: "system-ui, sans-serif" },
    tooltip,
    grid: { left: 90, right: 35, top: 25, bottom: 65 },
  };
  if (props.declaration.kind === "heatmap") {
    const cohorts = [...new Set(points.map((point) => point.cohort ?? ""))].toSorted();
    const ages = Array.from(
      { length: Math.max(0, ...points.map((point) => point.age ?? 0)) + 1 },
      (_, age) => age,
    );
    return {
      ...base,
      grid: { left: 110, right: 30, top: 25, bottom: 85 },
      xAxis: {
        type: "category",
        data: ages.map((age) => `M${age}`),
        axisLine: { lineStyle: { color: edge } },
        axisLabel: { color: ink },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: cohorts.map((cohort) => formatDate(cohort, true)),
        axisLine: { lineStyle: { color: edge } },
        axisLabel: { color: ink },
      },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 5,
        text: ["100%", "0%"],
        textStyle: { color: ink },
        inRange: { color: [lowColor, color] },
      },
      series: [
        {
          type: "heatmap",
          data: points.map((point) => ({
            name: point.key,
            value: [point.age ?? 0, cohorts.indexOf(point.cohort ?? ""), point.value],
          })),
          itemStyle: { borderColor: surface, borderWidth: 1 },
          label: {
            show: ages.length <= 12,
            color: ink,
            textBorderColor: surface,
            textBorderWidth: 2,
            formatter: (event) => {
              const point = pointMap.get(eventName(event) ?? "");
              return point ? `${point.value.toFixed(0)}%` : "";
            },
          },
          emphasis: { itemStyle: { borderColor: ink, borderWidth: 2 } },
        },
      ],
    };
  }
  const labels = monthLabels(props, points);
  const data = labels.map((label) => ({ name: label, value: pointMap.get(label)?.value ?? null }));
  return {
    ...base,
    xAxis: {
      type: "category",
      data: labels.map((label) => formatDate(label, props.result.data.table?.kind === "series")),
      axisLabel: { color: ink, hideOverlap: true },
      axisLine: { lineStyle: { color: edge } },
    },
    yAxis: {
      type: "value",
      scale: false,
      axisLabel: {
        color: ink,
        formatter: (value: number) => formatValue(value, props.result.data.unit),
      },
      splitLine: { lineStyle: { color: edge } },
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      { type: "slider", height: 18, bottom: 8, textStyle: { color: ink }, borderColor: edge },
    ],
    series:
      props.declaration.kind === "bar"
        ? [{ type: "bar", data, itemStyle: { color }, barMaxWidth: 55 }]
        : [
            {
              type: "line",
              data,
              connectNulls: false,
              symbolSize: 8,
              itemStyle: { color },
              lineStyle: { color, type: props.binding.properties.scenario ? "dashed" : "solid" },
            },
          ],
  };
}

/** Client-only ECharts views draw verified source rows; interactions never create analytical facts. */
export default function Charts(props: RendererProps) {
  const { binding, result, declaration, act } = props;
  const container = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string>();
  const points = chartPoints(props);
  const active = points.find((point) => point.key === selected);
  const update = useEffectEvent(
    (chart: EChartsType, element: HTMLElement, reducedMotion: boolean) =>
      chart.setOption(options(props, chartPoints(props), element, reducedMotion), {
        notMerge: true,
      }),
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
          <>
            <label>
              Cohort{" "}
              <select
                aria-label="Activation cohort"
                value={active?.cohort ?? ""}
                onChange={(event) =>
                  setSelected(points.find((point) => point.cohort === event.target.value)?.key)
                }
              >
                <option value="">Choose a cohort</option>
                {[...new Set(points.map((point) => point.cohort ?? ""))].map((cohort) => (
                  <option key={cohort} value={cohort}>
                    {formatDate(cohort, true)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Month since activation{" "}
              <select
                aria-label="Month since activation"
                disabled={!active}
                value={active?.age ?? ""}
                onChange={(event) =>
                  setSelected(
                    points.find(
                      (point) =>
                        point.cohort === active?.cohort && point.age === Number(event.target.value),
                    )?.key,
                  )
                }
              >
                {!active && <option value="">Choose a month</option>}
                {points
                  .filter((point) => point.cohort === active?.cohort)
                  .map((point) => (
                    <option key={point.key} value={point.age}>
                      Month {point.age}
                    </option>
                  ))}
              </select>
            </label>
          </>
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
