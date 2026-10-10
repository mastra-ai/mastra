"use client";
import type { Point } from "./shared.ts";
import type { ResultTable } from "../../../data-sources/source.ts";
import { formatDate } from "../../components/format.ts";

export function MatrixSelection({
  table,
  points,
  active,
  setSelected,
}: {
  table: ResultTable;
  points: readonly Point[];
  active: Point | undefined;
  setSelected: (key: string | undefined) => void;
}) {
  const xLabel = table.columns.find((column) => column.key === table.axes?.x)?.label ?? "Column";
  const yLabel = table.columns.find((column) => column.key === table.axes?.y)?.label ?? "Row";
  return (
    <>
      <label>
        {yLabel}{" "}
        <select
          aria-label={yLabel}
          value={active?.y ?? ""}
          onChange={(event) =>
            setSelected(points.find((point) => point.y === event.target.value)?.key)
          }
        >
          <option value="">Choose a row</option>
          {[...new Set(points.map((point) => point.y ?? ""))].map((y) => (
            <option key={y} value={y}>
              {formatDate(y, Boolean(table.cohort))}
            </option>
          ))}
        </select>
      </label>
      <label>
        {xLabel}{" "}
        <select
          aria-label={xLabel}
          disabled={!active}
          value={active?.x ?? ""}
          onChange={(event) =>
            setSelected(
              points.find((point) => point.y === active?.y && point.x === event.target.value)?.key,
            )
          }
        >
          {!active && <option value="">Choose a column</option>}
          {points
            .filter((point) => point.y === active?.y)
            .map((point) => (
              <option key={point.key} value={point.x}>
                {point.x}
              </option>
            ))}
        </select>
      </label>
    </>
  );
}
