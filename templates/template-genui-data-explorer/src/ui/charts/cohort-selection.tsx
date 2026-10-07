"use client";
import type { Point } from "./shared.ts";
import { formatDate } from "../../components/format.ts";

export function CohortSelection({
  points,
  active,
  setSelected,
}: {
  points: readonly Point[];
  active: Point | undefined;
  setSelected: (key: string | undefined) => void;
}) {
  return (
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
  );
}
