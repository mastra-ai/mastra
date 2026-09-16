import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManualResolution } from "./manual-resolution";

describe("ManualResolution", () => {
  it("renders a durable receipt without another submission control", () => {
    const html = renderToStaticMarkup(
      <ManualResolution
        context={{
          version: 2,
          activeTurnId: "turn-synthetic",
          receipt: {
            id: "manual-synthetic",
            actorId: "support-agent-demo",
            turnId: "turn-synthetic",
            createdAt: "2026-09-11T12:00:00.000Z",
            noteState: "delivered",
            closeState: "uncertain",
          },
        }}
        canResolve={false}
        onResolve={async () => undefined}
      />,
    );
    expect(html).toContain("Manual resolution recorded");
    expect(html).toContain("Note delivery: delivered");
    expect(html).toContain("close delivery: uncertain");
    expect(html).not.toContain("Record note and close");
  });

  it("keeps an earlier receipt as history and opens a fresh form for a newer turn", () => {
    const html = renderToStaticMarkup(
      <ManualResolution
        context={{
          version: 4,
          activeTurnId: "turn-new",
          receipt: {
            id: "manual-old",
            actorId: "support-agent-demo",
            turnId: "turn-old",
            createdAt: "2026-09-11T12:00:00.000Z",
            noteState: "delivered",
            closeState: "superseded",
          },
        }}
        canResolve
        onResolve={async () => undefined}
      />,
    );
    expect(html).toContain("Previous manual resolution recorded");
    expect(html).toContain("close delivery: superseded");
    expect(html).toContain("Record note and close");
  });
});
