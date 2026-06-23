import { createConfig } from '@internal/lint/eslint';
import reactRefresh from 'eslint-plugin-react-refresh';

const reactHooks = (await import('eslint-plugin-react-hooks')).default;

const config = await createConfig();

const restrictedPlaygroundUiBarrelImportSpecifiers = [
  {
    importNames: ['useCopyToClipboard'],
    message: 'Import useCopyToClipboard from @mastra/playground-ui/hooks/use-copy-to-clipboard.',
  },
  {
    importNames: ['useAutoscroll', 'UseAutoscrollOptions'],
    message: 'Import useAutoscroll exports from @mastra/playground-ui/hooks/use-autoscroll.',
  },
  {
    importNames: ['useInView'],
    message: 'Import useInView from @mastra/playground-ui/hooks/use-in-view.',
  },
  {
    importNames: ['useIsMobile'],
    message: 'Import useIsMobile from @mastra/playground-ui/hooks/use-is-mobile.',
  },
  {
    importNames: ['useIsApplePlatform', 'useKeyboardShortcutLabel'],
    message: 'Import keyboard shortcut hooks from @mastra/playground-ui/hooks/use-keyboard-shortcut-label.',
  },
  {
    importNames: ['Avatar', 'AvatarProps', 'AvatarSize'],
    message: 'Import Avatar exports from @mastra/playground-ui/components/Avatar.',
  },
  {
    importNames: [
      'Card',
      'CardHeader',
      'CardTitle',
      'CardDescription',
      'CardContent',
      'CardFooter',
      'CardProps',
      'CardHeaderProps',
      'CardTitleProps',
      'CardDescriptionProps',
      'CardContentProps',
      'CardFooterProps',
    ],
    message: 'Import Card exports from @mastra/playground-ui/components/Card.',
  },
  {
    importNames: ['Combobox', 'ComboboxOption', 'ComboboxProps'],
    message: 'Import Combobox exports from @mastra/playground-ui/components/Combobox.',
  },
  {
    importNames: [
      'Command',
      'CommandDialog',
      'CommandEmpty',
      'CommandGroup',
      'CommandInput',
      'CommandItem',
      'CommandList',
      'CommandSeparator',
      'CommandShortcut',
    ],
    message: 'Import Command exports from @mastra/playground-ui/components/Command.',
  },
  {
    importNames: ['CodeBlock', 'CodeBlockOption', 'CodeBlockOverflow', 'CodeBlockProps', 'CodeBlockSelector'],
    message: 'Import CodeBlock exports from @mastra/playground-ui/components/CodeBlock.',
  },
  {
    importNames: ['CodeDiff', 'CodeDiffProps'],
    message: 'Import CodeDiff exports from @mastra/playground-ui/components/CodeDiff.',
  },
  {
    importNames: ['ContentBlock', 'ContentBlockChildren', 'ContentBlockProps', 'ContentBlocks', 'ContentBlocksProps'],
    message: 'Import ContentBlocks exports from @mastra/playground-ui/components/ContentBlocks.',
  },
  {
    importNames: [
      'CalendarProps',
      'DatePicker',
      'DateTimePicker',
      'DateTimePickerContent',
      'DateTimePickerProps',
      'DefaultTrigger',
      'TimePicker',
      'TimePickerProps',
    ],
    message: 'Import DateTimePicker exports from @mastra/playground-ui/components/DateTimePicker.',
  },
  {
    importNames: ['DateRangePreset', 'DateTimeRangePicker', 'DateTimeRangePickerProps'],
    message: 'Import DateTimeRangePicker exports from @mastra/playground-ui/components/DateTimeRangePicker.',
  },
  {
    importNames: [
      'DataKeysAndValues',
      'DataKeysAndValuesProps',
      'DataKeysAndValuesKeyProps',
      'DataKeysAndValuesValueProps',
      'DataKeysAndValuesHeaderProps',
    ],
    message: 'Import DataKeysAndValues exports from @mastra/playground-ui/components/DataKeysAndValues.',
  },
  {
    importNames: [
      'DataPanel',
      'DataPanelProps',
      'DataPanelHeaderProps',
      'DataPanelHeadingProps',
      'DataPanelCloseButtonProps',
      'DataPanelNextPrevNavProps',
      'DataPanelLoadingDataProps',
      'DataPanelNoDataProps',
      'DataPanelContentProps',
      'DataPanelSectionHeadingProps',
    ],
    message: 'Import DataPanel exports from @mastra/playground-ui/components/DataPanel.',
  },
  {
    importNames: ['EntityHeader', 'EntityHeaderProps'],
    message: 'Import EntityHeader exports from @mastra/playground-ui/components/EntityHeader.',
  },
  {
    importNames: ['Entry', 'EntryProps'],
    message: 'Import Entry exports from @mastra/playground-ui/components/Entry.',
  },
  {
    importNames: ['ErrorBoundary', 'ErrorBoundaryFallbackProps', 'ErrorBoundaryProps'],
    message: 'Import ErrorBoundary exports from @mastra/playground-ui/components/ErrorBoundary.',
  },
  {
    importNames: ['Kbd', 'KbdProps'],
    message: 'Import Kbd exports from @mastra/playground-ui/components/Kbd.',
  },
  {
    importNames: [
      'InputGroup',
      'InputGroupAddon',
      'InputGroupButton',
      'InputGroupInput',
      'InputGroupTextarea',
      'InputGroupText',
      'InputGroupProps',
      'InputGroupAddonProps',
      'InputGroupButtonProps',
      'InputGroupInputProps',
      'InputGroupTextareaProps',
      'InputGroupTextProps',
    ],
    message: 'Import InputGroup exports from @mastra/playground-ui/components/InputGroup.',
  },
  {
    importNames: [
      'ItemList',
      'ItemListColumn',
      'ItemListSkeleton',
      'ItemListItemsScroller',
      'ItemListHeader',
      'ItemListIdCell',
      'ItemListMessage',
      'ItemListCell',
      'ItemListItemsSkeleton',
      'ItemListStatusCell',
      'ItemListHeaderCol',
      'ItemListVersionCell',
      'ItemListRowButton',
      'ItemListItemText',
      'ItemListItemStatus',
      'ItemListDateCell',
      'getItemListColumnTemplate',
      'getToNextItemFn',
      'getToPreviousItemFn',
      'ItemListItems',
      'ItemListNextPageLoading',
      'ItemListLabelCell',
      'ItemListRow',
      'ItemListRoot',
      'ItemListTextCell',
      'ItemListLinkCell',
      'ItemListPagination',
    ],
    message: 'Import ItemList exports from @mastra/playground-ui/components/ItemList.',
  },
  {
    importNames: ['KeyValueList', 'KeyValueListItemData', 'KeyValueListItemValue', 'KeyValueListProps'],
    message: 'Import KeyValueList exports from @mastra/playground-ui/components/KeyValueList.',
  },
  {
    importNames: ['MetricsDataTable'],
    message: 'Import MetricsDataTable from @mastra/playground-ui/components/MetricsDataTable.',
  },
  {
    importNames: ['MetricsFlexGrid'],
    message: 'Import MetricsFlexGrid from @mastra/playground-ui/components/MetricsFlexGrid.',
  },
  {
    importNames: ['MetricsLineChart', 'MetricsLineChartSeries', 'MetricsLineChartTooltip'],
    message: 'Import MetricsLineChart exports from @mastra/playground-ui/components/MetricsLineChart.',
  },
  {
    importNames: ['MetricsKpiCard'],
    message: 'Import MetricsKpiCard from @mastra/playground-ui/components/MetricsKpiCard.',
  },
  {
    importNames: ['MetricsCard'],
    message: 'Import MetricsCard from @mastra/playground-ui/components/MetricsCard.',
  },
  {
    importNames: ['PageHeader', 'PageHeaderRootProps', 'PageHeaderTitleProps', 'PageHeaderDescriptionProps'],
    message: 'Import PageHeader exports from @mastra/playground-ui/components/PageHeader.',
  },
  {
    importNames: ['PendingIndicator', 'PendingIndicatorProps'],
    message: 'Import PendingIndicator exports from @mastra/playground-ui/components/PendingIndicator.',
  },
  {
    importNames: ['PrevNextNav'],
    message: 'Import PrevNextNav from @mastra/playground-ui/components/PrevNextNav.',
  },
  {
    importNames: ['SettingsRow'],
    message: 'Import SettingsRow from @mastra/playground-ui/components/SettingsRow.',
  },
  {
    importNames: ['CardHeading', 'CardHeadingProps', 'SectionCard', 'SectionCardProps', 'SectionCardVariant'],
    message: 'Import SectionCard exports from @mastra/playground-ui/components/SectionCard.',
  },
  {
    importNames: ['Shimmer', 'ShimmerProps'],
    message: 'Import Shimmer exports from @mastra/playground-ui/components/Shimmer.',
  },
  {
    importNames: ['SideDialog', 'SideDialogRootProps'],
    message: 'Import SideDialog exports from @mastra/playground-ui/components/SideDialog.',
  },
  {
    importNames: ['Sections', 'SectionsProps'],
    message: 'Import Sections exports from @mastra/playground-ui/components/Sections.',
  },
  {
    importNames: ['Slider', 'SliderProps'],
    message: 'Import Slider exports from @mastra/playground-ui/components/Slider.',
  },
  {
    importNames: [
      'getStatusIcon',
      'ProcessStep',
      'ProcessStepList',
      'ProcessStepListItem',
      'ProcessStepListItemProps',
      'ProcessStepListProps',
      'ProcessStepProgressBar',
      'ProcessStepProgressBarProps',
    ],
    message: 'Import Steps exports from @mastra/playground-ui/components/Steps.',
  },
  {
    importNames: ['Tree'],
    message: 'Import Tree exports from @mastra/playground-ui/components/Tree.',
  },
  {
    importNames: [
      'Table',
      'TableProps',
      'Thead',
      'TheadProps',
      'Th',
      'ThProps',
      'Tbody',
      'TbodyProps',
      'Row',
      'RowProps',
      'Cell',
      'CellProps',
      'TxtCell',
      'DateTimeCell',
      'DateTimeCellProps',
      'EntryCell',
      'EntryCellProps',
      'formatDateCell',
      'useTableKeyboardNavigation',
      'UseTableKeyboardNavigationOptions',
      'UseTableKeyboardNavigationReturn',
    ],
    message: 'Import Table exports from @mastra/playground-ui/components/Table.',
  },
  {
    importNames: ['Truncate', 'TruncateProps'],
    message: 'Import Truncate exports from @mastra/playground-ui/components/Truncate.',
  },
].flatMap(restriction =>
  restriction.importNames.map(importName => ({
    selector: `ImportDeclaration[source.value="@mastra/playground-ui"] > ImportSpecifier[imported.name="${importName}"]`,
    message: restriction.message,
  })),
);

// Enforce the playground testing contract (packages/playground/AGENTS.md + the
// `playground-msw-tests` skill): drive the real @mastra/client-js + React Query
// stack and ONLY mock the network. Mocking our own data hooks/services/auth
// gating or the SDK hides cache, transport, and gating bugs. The allowed seams
// are MSW network handlers, jsdom DOM-API polyfills in vitest.setup.ts, and the
// three thin presentational seams (react-router's Navigate, a heavy child that
// has its own dedicated test, atoms needing global context).
const PROHIBITED_MOCK_MESSAGE =
  'Do not vi.mock our own data hooks/services/auth gating or the SDK. ' +
  'Drive the real @mastra/client-js + React Query stack through MSW network ' +
  'handlers and typed fixtures instead (see packages/playground/AGENTS.md and ' +
  'the playground-msw-tests skill). Allowed seams: MSW handlers, DOM-API ' +
  "polyfills in vitest.setup.ts, react-router's Navigate, and thin stubs of a " +
  'heavy child that has its own test.';

// First-argument string literals to vi.mock() that are always prohibited.
// Covers @ aliases for our domains/hooks/services and the two SDK packages.
// Relative-path mocks of the same modules (e.g. ../../hooks/use-x) are caught
// by the second selector.
// Patterns are matched against the vi.mock() module string. Forward slashes
// must be escaped as `\/` because esquery parses the value as a regex literal,
// and we use `(\/|$)` boundaries instead of a bare `$`.
const prohibitedMockModulePatterns = [
  '^@\\/domains\\/[^\\/]+\\/(hooks|services)(\\/|$)',
  '^@\\/domains\\/auth(\\/|$)',
  '^@\\/domains\\/(llm|agent-builder|agents)$',
  '^@\\/hooks(\\/|$)',
  '^@mastra\\/client-js$',
  '^@mastra\\/react$',
];

const restrictedTestMockSelectors = [
  {
    selector: prohibitedMockModulePatterns
      .map(
        pattern =>
          `CallExpression[callee.object.name="vi"][callee.property.name="mock"] > Literal[value=/${pattern}/]:first-child`,
      )
      .join(', '),
    message: PROHIBITED_MOCK_MESSAGE,
  },
  {
    // Relative-path mocks resolving to our own hooks/services/auth, use-* hooks,
    // or a domain barrel that re-exports them (agent-builder/llm/agents).
    selector:
      'CallExpression[callee.object.name="vi"][callee.property.name="mock"] > ' +
      'Literal[value=/^\\.\\.?\\/.*(\\/(hooks|services)\\/|\\/use-|\\/auth(\\/|$)|\\/(agent-builder|llm|agents)$)/]:first-child',
    message: PROHIBITED_MOCK_MESSAGE,
  },
];

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ['e2e/**'] },
  ...config,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-syntax': ['error', ...restrictedPlaygroundUiBarrelImportSpecifiers],
    },
  },
  {
    files: ['src/**/*.{test,spec}.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...restrictedPlaygroundUiBarrelImportSpecifiers,
        ...restrictedTestMockSelectors,
      ],
    },
  },
];
