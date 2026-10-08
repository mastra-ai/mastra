import { formatValue } from "../../src/components/format.ts";
import type { RendererProps } from "../../src/ui/renderer-props.ts";

export function CompactMetric({ binding, result }: RendererProps) {
  return (
    <p className="metric-value">
      <strong>{formatValue(result.data.value, result.data.unit)}</strong> ·{" "}
      {String(binding.properties.options?.emphasis ?? "verified")}
    </p>
  );
}
