import type { ChartOption, ChartTheme, Point } from "./shared.ts";
import type { RendererProps } from "../renderer-props.ts";
import { formatDate, formatValue } from "../../components/format.ts";

function monthLabels(props: RendererProps, points: readonly Point[]) {
  const period = props.result.data.period;
  if (props.result.data.table?.interval !== "month" || !period)
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
export function cartesianOptions(
  props: RendererProps,
  points: readonly Point[],
  theme: ChartTheme,
): ChartOption {
  const { base, ink, edge, color, pointMap } = theme;
  const labels = monthLabels(props, points);
  const data = labels.map((label) => ({ name: label, value: pointMap.get(label)?.value ?? null }));
  return {
    ...base,
    xAxis: {
      type: "category",
      data: labels.map((label) => formatDate(label, props.result.data.table?.interval === "month")),
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
