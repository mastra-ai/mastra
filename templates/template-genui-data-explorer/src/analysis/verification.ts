import { isDeepStrictEqual } from "node:util";
import {
  resultSchemaFor,
  resultRecordCount,
  groupingColumn,
  SourceError,
} from "../../data-sources/source.ts";
import type { AnalysisRequest, SourceDescriptor } from "../../data-sources/source.ts";

/** Connector output acquires authority only after identity, completeness and calculation checks. */
export function verifySourceResult(
  raw: unknown,
  inputData: AnalysisRequest,
  descriptor: SourceDescriptor,
  maxBytes: number,
  maxRows: number,
) {
  if (Buffer.byteLength(JSON.stringify(raw)) > maxBytes)
    throw new SourceError(
      "incomplete-result",
      "The source exceeded the result byte limit. Narrow the analysis.",
    );
  const capability = descriptor.capabilities.find((item) => item.metric === inputData.metric)!;
  const parsed = resultSchemaFor(capability).safeParse(raw);
  if (!parsed.success)
    throw new SourceError(
      "invalid-result",
      "The source returned malformed analytical data. Check the connector before retrying.",
    );
  const data = parsed.data;
  // Narrative assumptions belong to versioned server capabilities, not connector output.
  if (data.details) delete data.details.assumption;
  if (data.provenance.sourceId !== descriptor.id)
    throw new SourceError(
      "invalid-result",
      "The result source does not match the selected source.",
    );
  if (
    data.provenance.sourceVersion !== descriptor.version ||
    data.provenance.datasetVersion !== descriptor.datasetVersion ||
    data.provenance.metricVersion !== descriptor.metricVersion ||
    data.provenance.asOf !== descriptor.asOf ||
    !isDeepStrictEqual(data.provenance.coverage, descriptor.coverage)
  )
    throw new SourceError(
      "invalid-result",
      "The result source versions or clock changed. Reopen the source and retry.",
    );
  if (
    data.metric !== inputData.metric ||
    !isDeepStrictEqual(data.request, inputData) ||
    (inputData.period && !isDeepStrictEqual(data.period, inputData.period)) ||
    (inputData.horizon && !isDeepStrictEqual(data.period, inputData.horizon)) ||
    (inputData.asOf &&
      !inputData.horizon &&
      data.period &&
      (data.period.start !== inputData.asOf ||
        data.period.end !==
          new Date(new Date(`${inputData.asOf}T00:00:00Z`).getTime() + 86400000)
            .toISOString()
            .slice(0, 10)))
  )
    throw new SourceError(
      "invalid-result",
      "The result does not match the requested metric, period and filters.",
    );
  if (!data.provenance.complete || resultRecordCount(data) > maxRows)
    throw new SourceError(
      "incomplete-result",
      "The source returned incomplete or oversized data. Partial totals are unavailable.",
    );
  if (data.value !== null && (inputData.groupBy || inputData.records) && !data.table)
    throw new SourceError("invalid-result", "The requested grouped data or records are missing.");
  if (data.table) {
    const table = data.table;
    if (table.rows.length && !data.provenance.operations.length)
      throw new SourceError("invalid-result", "Grouped facts require actual source operations.");
    const valueKey = table.kind === "matrix" ? table.axes!.value : "value";
    if (table.kind === "series" && capability.groupedCalculation === "independent") {
      const axis = groupingColumn(table)!;
      const labels = table.rows.map((row) => String(row[axis.key]));
      if (
        !data.period ||
        new Set(labels).size !== labels.length ||
        labels.some((label) => label < data.period!.start || label >= data.period!.end) ||
        labels.some((label, index) => index > 0 && label <= labels[index - 1]!)
      )
        throw new SourceError(
          "invalid-result",
          "Independent observations need unique ordered dates inside the requested period.",
        );
    }
    if (
      data.period &&
      descriptor.coverage &&
      (data.period.start < descriptor.coverage.start || data.period.end > descriptor.coverage.end)
    )
      throw new SourceError(
        "invalid-result",
        "Grouped observations must be inside the advertised history.",
      );
    if (table.omitted !== 0)
      throw new SourceError(
        "incomplete-result",
        "Partial tables cannot represent complete results.",
      );
    if (
      table.columns.find((column) => column.key === valueKey)?.unit !== capability.unit &&
      table.kind !== "records"
    )
      throw new SourceError("invalid-result", "Table units do not match the metric.");
    if (
      table.rows.some((row) =>
        table.columns.some(
          (column) => column.unit === "USD cents" && !Number.isSafeInteger(row[column.key]),
        ),
      )
    )
      throw new SourceError("invalid-result", "Currency rows must be safe integer cents.");
    if (
      (inputData.records && table.kind !== "records") ||
      (inputData.groupBy &&
        table.kind !==
          capability.groupings?.find((group) => group.field === inputData.groupBy)?.kind) ||
      (!inputData.groupBy && !inputData.records)
    )
      throw new SourceError("invalid-result", "Table does not match the requested representation.");
    if (
      table.kind === "records" &&
      data.metric === "conversion" &&
      (table.rows.filter((row) => row.stage === "won").length !== data.numerator ||
        table.rows.length !== data.denominator)
    )
      throw new SourceError(
        "invalid-result",
        "Closed records do not reconcile to the verified counts.",
      );
    const values = table.rows.map((row) => row[valueKey]);
    if (values.some((value) => typeof value !== "number" || !Number.isFinite(value)))
      throw new SourceError("invalid-result", "Table values must be finite numbers.");
    if (table.kind !== "records") {
      for (const row of table.rows) {
        if (
          typeof row.numerator !== "number" ||
          typeof row.denominator !== "number" ||
          !Number.isSafeInteger(row.numerator) ||
          !Number.isSafeInteger(row.denominator) ||
          (capability.calculation === "percentage" ? row.denominator < 1 : row.denominator < 0) ||
          row[valueKey] !==
            (capability.calculation === "total"
              ? row.numerator
              : (row.numerator / row.denominator) * 100)
        )
          throw new SourceError("invalid-result", "Grouped calculation failed.");
      }
    }
    if (
      capability.calculation === "total" &&
      table.rows.reduce((sum, row) => sum + (typeof row.value === "number" ? row.value : 0), 0) !==
        data.value
    )
      throw new SourceError(
        "invalid-result",
        "Table values do not reconcile to the verified total.",
      );
    if (
      capability.calculation === "percentage" &&
      capability.groupedCalculation !== "independent" &&
      table.kind !== "records" &&
      (table.rows.reduce(
        (sum, row) => sum + (typeof row.numerator === "number" ? row.numerator : 0),
        0,
      ) !== data.numerator ||
        table.rows.reduce(
          (sum, row) => sum + (typeof row.denominator === "number" ? row.denominator : 0),
          0,
        ) !== data.denominator)
    )
      throw new SourceError("invalid-result", "Grouped closed-deal counts do not reconcile.");
  }
  return { data, capability };
}
