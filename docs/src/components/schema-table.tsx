"use client";
import React from "react";
import { useMDXComponents } from "nextra-theme-docs";

interface ColumnConstraint {
  type: "nullable" | "primaryKey" | "foreignKey" | "unique" | "default";
  value?: string | boolean;
  description?: string;
}

interface SchemaColumn {
  name: string;
  type: string;
  description: string;
  constraints?: ColumnConstraint[];
}

interface SchemaTableProps {
  columns: SchemaColumn[];
}

export const SchemaTable: React.FC<SchemaTableProps> = ({ columns = [] }) => {
  const renderConstraints = (constraints: ColumnConstraint[] | undefined) => {
    if (!constraints || constraints.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mt-1">
        {constraints.map((constraint, idx) => {
          let bgColor = "bg-zinc-200 dark:bg-zinc-800";
          let textColor = "text-zinc-600 dark:text-zinc-400";

          // Special styling for different constraint types
          switch (constraint.type) {
            case "primaryKey":
              bgColor = "bg-blue-100 dark:bg-blue-900";
              textColor = "text-blue-600 dark:text-blue-300";
              break;
            case "foreignKey":
              bgColor = "bg-green-100 dark:bg-green-900";
              textColor = "text-green-600 dark:text-green-300";
              break;
            case "unique":
              bgColor = "bg-purple-100 dark:bg-purple-900";
              textColor = "text-purple-600 dark:text-purple-300";
              break;
            case "nullable":
              if (constraint.value === false) {
                bgColor = "bg-yellow-100 dark:bg-yellow-900";
                textColor = "text-yellow-800 dark:text-yellow-200";
              }
              break;
          }

          return (
            <div
              key={idx}
              className={`px-2 py-1 rounded-md text-xs font-mono ${bgColor} ${textColor}`}
              title={constraint.description}
            >
              {constraint.type === "default"
                ? `default: ${constraint.value}`
                : constraint.type === "foreignKey"
                  ? `FK → ${constraint.value}`
                  : constraint.type === "nullable"
                    ? constraint.value === false
                      ? "NOT NULL"
                      : "CAN BE NULL"
                    : constraint.type.toUpperCase()}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {columns.map((column, index) => (
          <div
            key={index}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <div className="flex flex-row items-start gap-2">
              <div className="font-mono text-sm font-medium">{column.name}</div>
              <div className="font-mono text-sm text-zinc-500">
                {column.type}
              </div>
            </div>
            <div className="text-sm text-zinc-500">
              <MDXText>{column.description ?? ""}</MDXText>
            </div>
            {renderConstraints(column.constraints)}
          </div>
        ))}
      </div>
    </div>
  );
};

const MDXText = ({ children }: { children: string }) => {
  const components = useMDXComponents();
  return (
    <>
      {children
        .split(/(`[^`]+`)/)
        .map((part, i) =>
          part.startsWith("`") && components.code ? (
            <components.code key={i}>{part.slice(1, -1)}</components.code>
          ) : (
            part
          ),
        )}
    </>
  );
};
