import React from "react";

interface Operator {
  name: string;
  description: string;
  example: string;
  supportedBy: string[];
}

interface OperatorsTableProps {
  title: string;
  operators: Operator[];
}

export default function OperatorsTable({
  title,
  operators,
}: OperatorsTableProps): React.JSX.Element {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <h3
        style={{ marginBottom: "1rem", fontSize: "1.125rem", fontWeight: 600 }}
      >
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {operators.map((operator, index) => {
          return (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                paddingTop: "0.75rem",
                paddingBottom: "0.75rem",
                borderBottom:
                  index === operators.length - 1
                    ? "none"
                    : "1px solid var(--ifm-color-emphasis-300)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "0.5rem",
                  alignItems: "flex-start",
                }}
              >
                <code
                  style={{
                    fontFamily: "var(--ifm-font-family-monospace)",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--ifm-code-color)",
                    backgroundColor: "var(--ifm-code-background)",
                    padding: "0.125rem 0.375rem",
                    borderRadius: "0.25rem",
                  }}
                >
                  {operator.name}
                </code>
              </div>
              <div
                style={{
                  fontSize: "0.875rem",
                  lineHeight: "1.5rem",
                  color: "var(--ifm-color-emphasis-800)",
                }}
              >
                {operator.description}
              </div>
              <div
                style={{
                  fontFamily: "var(--ifm-font-family-monospace)",
                  fontSize: "0.8125rem",
                  backgroundColor: "var(--ifm-code-background)",
                  padding: "0.5rem",
                  borderRadius: "0.375rem",
                  overflowX: "auto",
                }}
              >
                {operator.example}
              </div>
              <div
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--ifm-color-emphasis-600)",
                  fontStyle: "italic",
                }}
              >
                Supported by: {operator.supportedBy.join(", ")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
