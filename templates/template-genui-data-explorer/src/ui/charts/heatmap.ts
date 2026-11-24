import type { ChartOption, ChartTheme, Point } from "./shared.ts";
import { eventName } from "./shared.ts";
import type { RendererProps } from "../renderer-props.ts";
import { formatDate, formatValue } from "../../components/format.ts";

export function heatmapOptions(
  props: RendererProps,
  points: readonly Point[],
  theme: ChartTheme,
): ChartOption {
  const { base, ink, edge, color, lowColor, surface, pointMap } = theme;
  const ys = [...new Set(points.map((point) => point.y ?? ""))];
  const xs = [...new Set(points.map((point) => point.x ?? ""))];
  const table = props.result.data.table;
  const xLabel = table?.columns.find((column) => column.key === table.axes?.x)?.label;
  const yLabel = table?.columns.find((column) => column.key === table.axes?.y)?.label;
  const minimum = Math.min(0, ...points.map((point) => point.value));
  const maximum = Math.max(
    props.result.data.unit === "percent" ? 100 : 1,
    ...points.map((point) => point.value),
  );
  return {
    ...base,
    grid: { left: 110, right: 30, top: 25, bottom: 85 },
    xAxis: {
      type: "category",
      data: xs,
      ...(xLabel ? { name: xLabel, nameLocation: "middle", nameGap: 28 } : {}),
      axisLine: { lineStyle: { color: edge } },
      axisLabel: { color: ink },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: ys.map((value) => formatDate(value, Boolean(table?.cohort))),
      ...(yLabel ? { name: yLabel, nameLocation: "middle", nameGap: 65 } : {}),
      axisLine: { lineStyle: { color: edge } },
      axisLabel: { color: ink },
    },
    visualMap: {
      min: minimum,
      max: maximum,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 5,
      text: [
        formatValue(maximum, props.result.data.unit),
        formatValue(minimum, props.result.data.unit),
      ],
      textStyle: { color: ink },
      inRange: { color: [lowColor, color] },
    },
    series: [
      {
        type: "heatmap",
        data: points.map((point) => ({
          name: point.key,
          value: [xs.indexOf(point.x ?? ""), ys.indexOf(point.y ?? ""), point.value],
        })),
        itemStyle: { borderColor: surface, borderWidth: 1 },
        label: {
          show: xs.length <= 12,
          color: ink,
          textBorderColor: surface,
          textBorderWidth: 2,
          formatter: (event) => {
            const point = pointMap.get(eventName(event) ?? "");
            return point
              ? formatValue(
                  point.value,
                  props.result.data.unit === "percent" ? "percent" : undefined,
                )
              : "";
          },
        },
        emphasis: { itemStyle: { borderColor: ink, borderWidth: 2 } },
      },
    ],
  };
}
