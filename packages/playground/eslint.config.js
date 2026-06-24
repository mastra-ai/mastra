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
    importNames: ['AlertDialog'],
    message: 'Import AlertDialog from @mastra/playground-ui/components/AlertDialog.',
  },
  {
    importNames: ['Avatar', 'AvatarProps', 'AvatarSize'],
    message: 'Import Avatar exports from @mastra/playground-ui/components/Avatar.',
  },
  {
    importNames: ['Badge', 'BadgeProps'],
    message: 'Import Badge exports from @mastra/playground-ui/components/Badge.',
  },
  {
    importNames: ['Breadcrumb', 'BreadcrumbProps', 'Crumb', 'CrumbProps'],
    message: 'Import Breadcrumb exports from @mastra/playground-ui/components/Breadcrumb.',
  },
  {
    importNames: [
      'ButtonsGroup',
      'ButtonsGroupProps',
      'ButtonsGroupSeparator',
      'ButtonsGroupSeparatorProps',
      'ButtonsGroupSpacing',
      'ButtonsGroupText',
      'ButtonsGroupTextProps',
      'buttonsGroupVariants',
    ],
    message: 'Import ButtonsGroup exports from @mastra/playground-ui/components/ButtonsGroup.',
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
    importNames: ['Checkbox', 'CheckboxProps', 'CheckedState'],
    message: 'Import Checkbox exports from @mastra/playground-ui/components/Checkbox.',
  },
  {
    importNames: ['Chip', 'ChipProps', 'ChipsGroup', 'ChipsGroupProps'],
    message: 'Import Chip exports from @mastra/playground-ui/components/Chip.',
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
    importNames: [
      'CodeEditor',
      'CodeEditorProps',
      'CodeEditorLanguage',
      'useCodemirrorTheme',
      'codeLanguages',
      'highlight',
      'variableHighlight',
      'VARIABLE_PATTERN',
      'createVariableAutocomplete',
      'flattenSchemaToVariables',
      'VariableCompletion',
    ],
    message: 'Import CodeEditor exports from @mastra/playground-ui/components/CodeEditor.',
  },
  {
    importNames: ['CodeDiff', 'CodeDiffProps'],
    message: 'Import CodeDiff exports from @mastra/playground-ui/components/CodeDiff.',
  },
  {
    importNames: ['Column', 'Columns', 'ColumnsProps', 'MultiColumn', 'MultiColumnProps'],
    message: 'Import Columns exports from @mastra/playground-ui/components/Columns.',
  },
  {
    importNames: ['ContentBlock', 'ContentBlockChildren', 'ContentBlockProps', 'ContentBlocks', 'ContentBlocksProps'],
    message: 'Import ContentBlocks exports from @mastra/playground-ui/components/ContentBlocks.',
  },
  {
    importNames: ['CopyButton', 'CopyButtonProps'],
    message: 'Import CopyButton exports from @mastra/playground-ui/components/CopyButton.',
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
    importNames: ['EmptyState', 'EmptyStateProps'],
    message: 'Import EmptyState exports from @mastra/playground-ui/components/EmptyState.',
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
    importNames: ['ErrorState', 'ErrorStateProps'],
    message: 'Import ErrorState exports from @mastra/playground-ui/components/ErrorState.',
  },
  {
    importNames: [
      'FieldBlock',
      'FieldBlocksLayout',
      'TextFieldBlock',
      'TextFieldBlockProps',
      'SearchFieldBlock',
      'SearchFieldBlockProps',
      'SelectFieldBlock',
      'SelectFieldBlockProps',
    ],
    message: 'Import FormFieldBlocks exports from @mastra/playground-ui/components/FormFieldBlocks.',
  },
  {
    importNames: ['Header', 'HeaderProps', 'HeaderTitle', 'HeaderAction', 'HeaderGroup'],
    message: 'Import Header exports from @mastra/playground-ui/components/Header.',
  },
  {
    importNames: ['HorizontalBars'],
    message: 'Import HorizontalBars from @mastra/playground-ui/components/HorizontalBars.',
  },
  {
    importNames: ['Input', 'InputProps'],
    message: 'Import Input exports from @mastra/playground-ui/components/Input.',
  },
  {
    importNames: ['Kbd', 'KbdProps'],
    message: 'Import Kbd exports from @mastra/playground-ui/components/Kbd.',
  },
  {
    importNames: ['Label'],
    message: 'Import Label from @mastra/playground-ui/components/Label.',
  },
  {
    importNames: [
      'JSONSchemaForm',
      'Root',
      'JSONSchemaFormRootProps',
      'Field',
      'JSONSchemaFormFieldProps',
      'FieldList',
      'JSONSchemaFormFieldListProps',
      'FieldName',
      'JSONSchemaFormFieldNameProps',
      'FieldType',
      'JSONSchemaFormFieldTypeProps',
      'FieldDescription',
      'JSONSchemaFormFieldDescriptionProps',
      'FieldOptional',
      'JSONSchemaFormFieldOptionalProps',
      'FieldNullable',
      'JSONSchemaFormFieldNullableProps',
      'FieldRemove',
      'JSONSchemaFormFieldRemoveProps',
      'NestedFields',
      'JSONSchemaFormNestedFieldsProps',
      'AddField',
      'JSONSchemaFormAddFieldProps',
      'useJSONSchemaForm',
      'useJSONSchemaFormField',
      'useJSONSchemaFormNestedContext',
      'SchemaField',
      'SchemaFieldType',
      'createField',
      'fieldsToJSONSchema',
      'jsonSchemaToFields',
    ],
    message: 'Import JSONSchemaForm exports from @mastra/playground-ui/components/JSONSchemaForm.',
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
    importNames: ['ListSearch', 'ListSearchProps'],
    message: 'Import ListSearch exports from @mastra/playground-ui/components/ListSearch.',
  },
  {
    importNames: ['Logo', 'LogoProps', 'LogoWithoutText'],
    message: 'Import Logo exports from @mastra/playground-ui/components/Logo.',
  },
  {
    importNames: [
      'MainHeader',
      'MainHeaderRootProps',
      'MainHeaderTitleProps',
      'MainHeaderDescriptionProps',
      'MainHeaderColumnProps',
    ],
    message: 'Import MainHeader exports from @mastra/playground-ui/components/MainHeader.',
  },
  {
    importNames: [
      'MainContentLayout',
      'MainContentContent',
      'MainContentContentProps',
      'GetMainContentContentClassNameArgs',
      'getMainContentContentClassName',
    ],
    message: 'Import MainContent exports from @mastra/playground-ui/components/MainContent.',
  },
  {
    importNames: [
      'MainSidebar',
      'MainSidebarProvider',
      'SidebarState',
      'MainSidebarProviderProps',
      'useMainSidebar',
      'useMaybeSidebar',
      'navItemClasses',
      'NavLink',
      'NavSection',
      'MainSidebarTrigger',
      'MainSidebarMobileTrigger',
      'getIsLinkActive',
    ],
    message: 'Import MainSidebar exports from @mastra/playground-ui/components/MainSidebar.',
  },
  {
    importNames: ['MarkdownRenderer', 'MarkdownRendererProps'],
    message: 'Import MarkdownRenderer exports from @mastra/playground-ui/components/MarkdownRenderer.',
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
    importNames: ['Notice', 'NoticeVariant', 'NoticeRootProps', 'NoticeMessageProps'],
    message: 'Import Notice exports from @mastra/playground-ui/components/Notice.',
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
    importNames: ['PermissionDenied', 'PermissionDeniedProps'],
    message: 'Import PermissionDenied exports from @mastra/playground-ui/components/PermissionDenied.',
  },
  {
    importNames: [
      'PropertyFilterOption',
      'PropertyFilterField',
      'PropertyFilterToken',
      'PropertyFilterActions',
      'PropertyFilterActionsProps',
      'PropertyFilterApplied',
      'PropertyFilterAppliedProps',
      'PropertyFilterCreator',
      'PropertyFilterCreatorProps',
      'PickMultiPanel',
      'PickMultiPanelProps',
    ],
    message: 'Import PropertyFilter exports from @mastra/playground-ui/components/PropertyFilter.',
  },
  {
    importNames: ['PrevNextNav'],
    message: 'Import PrevNextNav from @mastra/playground-ui/components/PrevNextNav.',
  },
  {
    importNames: ['RadioGroup', 'RadioGroupItem'],
    message: 'Import RadioGroup exports from @mastra/playground-ui/components/RadioGroup.',
  },
  {
    importNames: ['Searchbar', 'SearchbarWrapper', 'SearchbarProps'],
    message: 'Import Searchbar exports from @mastra/playground-ui/components/Searchbar.',
  },
  {
    importNames: ['Section', 'SectionProps', 'SectionRoot', 'SubSectionRoot', 'SectionRootProps'],
    message: 'Import Section exports from @mastra/playground-ui/components/Section.',
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
    importNames: ['SessionExpired', 'SessionExpiredProps'],
    message: 'Import SessionExpired exports from @mastra/playground-ui/components/SessionExpired.',
  },
  {
    importNames: ['Slider', 'SliderProps'],
    message: 'Import Slider exports from @mastra/playground-ui/components/Slider.',
  },
  {
    importNames: ['Skeleton'],
    message: 'Import Skeleton from @mastra/playground-ui/components/Skeleton.',
  },
  {
    importNames: ['Spinner', 'SpinnerProps', 'SpinnerSize', 'SpinnerVariant'],
    message: 'Import Spinner exports from @mastra/playground-ui/components/Spinner.',
  },
  {
    importNames: ['StatusBadge', 'StatusBadgeProps'],
    message: 'Import StatusBadge exports from @mastra/playground-ui/components/StatusBadge.',
  },
  {
    importNames: ['Switch', 'SwitchProps'],
    message: 'Import Switch exports from @mastra/playground-ui/components/Switch.',
  },
  {
    importNames: ['Textarea', 'TextareaProps'],
    message: 'Import Textarea exports from @mastra/playground-ui/components/Textarea.',
  },
  {
    importNames: ['ThemeProvider', 'useTheme', 'ThemeProviderProps', 'Theme', 'ResolvedTheme', 'ThemeContextValue'],
    message: 'Import ThemeProvider exports from @mastra/playground-ui/components/ThemeProvider.',
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
    importNames: [
      'Tabs',
      'TabsRootProps',
      'TabList',
      'TabListProps',
      'Tab',
      'TabProps',
      'TabContent',
      'TabContentProps',
    ],
    message: 'Import Tabs exports from @mastra/playground-ui/components/Tabs.',
  },
  {
    importNames: ['TextAndIcon', 'TextAndIconProps', 'getShortId'],
    message: 'Import Text exports from @mastra/playground-ui/components/Text.',
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
  '^@\\/domains\\/[^\\/]+(?:\\/[^\\/]+)*\\/(hooks|services)(\\/|$)',
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
