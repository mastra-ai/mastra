"use client";
import { useState } from "react";
import { groupingColumn } from "../../data-sources/source.ts";
import type { RendererProps } from "./renderer-props.ts";
import { formatDate, formatValue } from "../components/format.ts";

export function DataTable({ binding, result, declaration, act }: RendererProps) {
  const [page, setPage] = useState(0);
  const table = result.data.table;
  if (!table) return <p>{formatValue(result.data.value, result.data.unit)}</p>;
  const pageSize = declaration.defaults.pageSize;
  const start = page * pageSize;
  const rows = table.rows.slice(start, start + pageSize);
  const labelColumn = groupingColumn(table);
  const drill =
    declaration.actions.includes("drill") && labelColumn !== undefined && table.kind !== "records";
  return (
    <div className="table-scroll">
      <table>
        <caption>
          {table.rows.length}{" "}
          {table.kind === "records"
            ? table.rows.length === 1
              ? "record"
              : "records"
            : table.rows.length === 1
              ? "result"
              : "results"}
        </caption>
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th scope="col" key={column.key}>
                {column.label}
                {column.unit ? ` (${column.unit === "USD cents" ? "USD" : column.unit})` : ""}
              </th>
            ))}
            {drill && <th scope="col">Inspect</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={start + index}>
              {table.columns.map((column) => (
                <td key={column.key}>
                  {column.type === "date"
                    ? formatDate(String(row[column.key]))
                    : formatValue(row[column.key], column.unit)}
                </td>
              ))}
              {drill && (
                <td>
                  <button
                    onClick={() =>
                      act({
                        type: "drill",
                        componentId: binding.id,
                        label: String(labelColumn && row[labelColumn.key]),
                      })
                    }
                  >
                    Inspect {formatDate(String(labelColumn && row[labelColumn.key]))}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length === 0 && <p>No records in the covered filtered period.</p>}
      <nav aria-label={`${binding.properties.title} table pages`}>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page + 1} of {Math.max(1, Math.ceil(table.rows.length / pageSize))}
        </span>
        <button disabled={start + pageSize >= table.rows.length} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </nav>
    </div>
  );
}
