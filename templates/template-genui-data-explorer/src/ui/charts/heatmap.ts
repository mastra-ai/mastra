import type { ChartOption, ChartTheme, Point } from "./shared.ts";
import { eventName } from "./shared.ts";
import { formatDate } from "../../components/format.ts";

export function heatmapOptions(points: readonly Point[], theme: ChartTheme): ChartOption {
  const { base, ink, edge, color, lowColor, surface, pointMap } = theme;
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
