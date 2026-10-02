import type { Scenario } from '../scenario.js';

import { linearScenario } from './linear.js';
import { notionScenario } from './notion.js';
import { googleSheetScenario } from './google-sheet.js';

/**
 * Every registered smoke scenario. The runner iterates these alongside the
 * provider registry: a provider in `TOOLS` but not here reports as
 * `skipped: no scenario`; a scenario here for a provider not in `TOOLS` runs
 * anyway (useful for MCP-only providers that only show up in a project toolset
 * at discovery time).
 *
 * Append scenarios in alphabetical order to keep the report deterministic.
 */
export const scenarios: readonly Scenario[] = [googleSheetScenario, linearScenario, notionScenario];
