"use client";
import React from "react";
import { Var, T } from "gt-next/client";

interface Operator {
  name: string;
  description: string;
  example: string;
  supportedBy: string[];
}

interface OperatorsTableProps {
  operators?: Operator[];
  title?: string;
}

export const OperatorsTable: React.FC<OperatorsTableProps> = ({
  operators = [],
  title,
}) => {
  const formatExample = (example: string) => {
    // Remove outer braces and clean up the content
    const content = example.slice(1, -1).trim();

    // Handle logical operators ($and, $or, etc.) specially
    if (content.startsWith("$")) {
      const [operator, rest] = content.split(": [");
      if (rest) {
        const items = rest
          .slice(0, -1)
          .split("}, {")
          .map((item) => item.trim());
        return `{
  ${operator}: [
    { ${items.map((item) => item.replace(/^\{?\s*/, "")).join(" },\n    { ")} }
  ]
}`;
      }
    }

    // Handle nested objects
    if (content.includes("}, {")) {
      return `{
  ${content
    .split("}, {")
    .map((item) => item.trim().replace(/^\{?\s*/, ""))
    .join(" },\n  { ")}
}`;
    }

    // Handle simple key-value pairs with arrays
    if (content.includes(": {") && content.includes("[")) {
      const [key, value] = content.split(": {");
      const arrayContent = value
        .replace(/^\s*\$\w+:\s*/, "")
        .replace(/\s*}\s*$/, "");
      return `{
  ${key}: {
    ${value.match(/\$\w+/)?.[0]}: ${arrayContent}
  }
}`;
    }

    // Handle simple key-value pairs
    if (content.includes(": {")) {
      const [key, value] = content.split(": {");
      return `{
  ${key}: {
    ${value.replace(/}\s*$/, "").trim()}
  }
}`;
    }

    // Default case - just add proper indentation
    return `{
  ${content}
}`;
  };

  return (
    <T id="components.operators_table.0">
      <div className="my-6">
        <Var>
          {title && (
            <h3 className="text-xl font-semibold mb-6 text-zinc-900 dark:text-zinc-100">
              {title}
            </h3>
          )}
        </Var>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-900/10 dark:border-zinc-100/10">
                <th className="py-3 pr-8 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Operator
                </th>
                <th className="py-3 pr-8 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Description
                </th>
                <th className="py-3 pr-8 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Example
                </th>
                <th className="py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Supported By
                </th>
              </tr>
            </thead>
            <tbody>
              <Var>
                {operators.map((operator, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-zinc-900/5 dark:border-zinc-100/5 last:border-none"
                  >
                    <td className="py-4 pr-8 align-top">
                      <code className="bg-zinc-900/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono text-zinc-900 dark:text-zinc-100">
                        {operator.name}
                      </code>
                    </td>
                    <td className="py-4 pr-8 align-top text-sm text-zinc-600 dark:text-zinc-400 max-w-[200px]">
                      {operator.description}
                    </td>
                    <td className="py-4 pr-8 align-top min-w-[50px]">
                      <div className="bg-zinc-900/10 dark:bg-white/10 rounded-lg">
                        <pre className="p-3 text-sm font-mono text-zinc-900 dark:text-zinc-100 whitespace-pre">
                          <code>{formatExample(operator.example)}</code>
                        </pre>
                      </div>
                    </td>
                    <td className="py-4 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {operator.supportedBy.map((store, storeIdx) => (
                          <span
                            key={storeIdx}
                            className="bg-zinc-900/10 dark:bg-white/10 px-2 py-0.5 rounded text-sm text-zinc-900 dark:text-zinc-100"
                          >
                            {store}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </Var>
            </tbody>
          </table>
        </div>
      </div>
    </T>
  );
};
