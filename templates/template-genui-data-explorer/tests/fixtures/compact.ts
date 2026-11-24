import { z } from "zod";
import { componentProperties } from "../../src/components/catalog.ts";
import type { ComponentDeclaration } from "../../src/components/catalog.ts";

/** Custom view used only to exercise catalog extension and property validation. */
export const compact: ComponentDeclaration = {
  id: "compact",
  kind: "metric",
  version: "1",
  description:
    "Compact verified KPI; options.emphasis chooses a validated verification label. Supports comparison.",
  enabled: true,
  roles: ["scalar", "series", "ranked", "records"],
  units: ["USD cents", "percent"],
  actions: ["compare"],
  properties: componentProperties.extend({
    options: z.strictObject({ emphasis: z.enum(["verified", "audited"]) }),
  }),
  defaults: { pageSize: 5 },
};
