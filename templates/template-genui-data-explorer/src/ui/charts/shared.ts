import type { ComposeOption } from "echarts/core";
import type { LineSeriesOption, BarSeriesOption, HeatmapSeriesOption } from "echarts/charts";
import type {
  GridComponentOption,
  TooltipComponentOption,
  VisualMapComponentOption,
  DataZoomComponentOption,
} from "echarts/components";
import type { RendererProps } from "../renderer-props.ts";
import { formatDate, formatValue } from "../../components/format.ts";
export type ChartOption = ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | HeatmapSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | VisualMapComponentOption
  | DataZoomComponentOption
>;
export interface Point {
  key: string;
  label: string;
  value: number;
  cohort?: string;
  age?: number;
  denominator?: number;
  numerator?: number;
}
export function chartPoints({ binding, result }: RendererProps): Point[] {
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
export function eventName(event: unknown) {
  return event && typeof event === "object" && "name" in event && typeof event.name === "string"
    ? event.name
    : undefined;
}
export function chartTheme(
  props: RendererProps,
  points: readonly Point[],
  container: HTMLElement,
  reducedMotion: boolean,
) {
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
  return { base, color, ink, edge, surface, lowColor, pointMap };
}

export type ChartTheme = ReturnType<typeof chartTheme>;
