import type { DashboardBuiltInWidgetKind, DashboardDefinition, DashboardWidget } from '@mastra/core/storage/dashboards';
import type { KpisOptions } from '@mastra/playground-ui/domains/dashboards/kinds/kpis/options';
import type { ScoresOptions } from '@mastra/playground-ui/domains/dashboards/kinds/scores/options';
import type { TableColumnOptions, TableOptions } from '@mastra/playground-ui/domains/dashboards/lib/table';
import type { TimeseriesOptions } from '@mastra/playground-ui/domains/dashboards/lib/timeseries';
import type {
  CHART_COLOR_NAMES,
  ValueExpr,
  ValueFormat,
  ValueRef,
} from '@mastra/playground-ui/domains/dashboards/lib/values';
import { expectTypeOf, it } from 'vitest';
import type { z } from 'zod/v4';
import type {
  strictDashboardDefinitionSchema,
  strictDashboardWidgetSchema,
  DashboardChartColor,
  DashboardKpisOptions,
  DashboardScoresOptions,
  DashboardTableColumnOptions,
  DashboardTableOptions,
  DashboardTimeseriesOptions,
  DashboardValueExpr,
  DashboardValueFormat,
  DashboardValueRef,
  StrictDashboardDefinition,
  StrictDashboardWidget,
} from '../dashboards';

it("types each kind's options as the kind's own schema reads them", () => {
  expectTypeOf<DashboardValueRef>().toEqualTypeOf<ValueRef>();
  expectTypeOf<DashboardValueExpr>().toEqualTypeOf<ValueExpr>();
  expectTypeOf<DashboardValueFormat>().toEqualTypeOf<ValueFormat>();
  expectTypeOf<DashboardChartColor>().toEqualTypeOf<(typeof CHART_COLOR_NAMES)[number]>();
  expectTypeOf<DashboardKpisOptions>().toEqualTypeOf<KpisOptions>();
  expectTypeOf<DashboardTableOptions>().toEqualTypeOf<TableOptions>();
  expectTypeOf<DashboardTableColumnOptions>().toEqualTypeOf<TableColumnOptions>();
  expectTypeOf<DashboardTimeseriesOptions>().toEqualTypeOf<TimeseriesOptions>();
  expectTypeOf<DashboardScoresOptions>().toEqualTypeOf<ScoresOptions>();
});

it('types a strict widget as one of every built-in kind, within what core accepts', () => {
  expectTypeOf<StrictDashboardWidget['kind']>().toEqualTypeOf<DashboardBuiltInWidgetKind>();
  expectTypeOf<StrictDashboardWidget>().toExtend<DashboardWidget>();
  expectTypeOf<StrictDashboardDefinition>().toExtend<DashboardDefinition>();
});

it('types what the schemas return as the strict types', () => {
  expectTypeOf<z.output<typeof strictDashboardDefinitionSchema>>().toEqualTypeOf<StrictDashboardDefinition>();
  expectTypeOf<z.output<typeof strictDashboardWidgetSchema>>().toEqualTypeOf<StrictDashboardWidget>();
});
