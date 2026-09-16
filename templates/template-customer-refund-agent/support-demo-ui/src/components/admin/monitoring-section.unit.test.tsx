import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OperationHealth } from "./monitoring-section";

describe("monitoring operation aggregates", () => {
  it("renders individual workflow, provider, and tool health entries", () => {
    const entries = [
      { operation: "inspect-order", calls: 3, errorRate: 1 / 3, p95Ms: 24 },
    ];
    const html = [
      renderToStaticMarkup(
        <OperationHealth title="Workflow stages" entries={entries} />,
      ),
      renderToStaticMarkup(
        <OperationHealth title="Provider operations" entries={entries} />,
      ),
      renderToStaticMarkup(
        <OperationHealth title="Tool operations" entries={entries} />,
      ),
    ].join("\n");

    expect(html).toContain("Workflow stages");
    expect(html).toContain("Provider operations");
    expect(html).toContain("Tool operations");
    expect(html).toContain("inspect-order: 3 calls");
    expect(html).toContain("errors 33%");
    expect(html).toContain("p95 24 ms");
  });

  it("renders an explicit unavailable state for each empty aggregate", () => {
    const html = renderToStaticMarkup(
      <OperationHealth title="Provider operations" entries={[]} />,
    );
    expect(html).toContain("Unavailable — no retained spans.");
  });
});
