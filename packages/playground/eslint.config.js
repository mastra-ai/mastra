import { createConfig } from '@internal/lint/eslint';
import reactRefresh from 'eslint-plugin-react-refresh';

const reactHooks = (await import('eslint-plugin-react-hooks')).default;

const config = await createConfig();

const playgroundUiIconImportNames = [
  'AgentCoinIcon',
  'AgentIcon',
  'AgentNetworkCoinIcon',
  'AiIcon',
  'AmazonIcon',
  'AnthropicChatIcon',
  'AnthropicMessagesIcon',
  'ApiIcon',
  'AzureIcon',
  'BranchIcon',
  'CheckIcon',
  'ChevronIcon',
  'CohereIcon',
  'CommitIcon',
  'CrossIcon',
  'DatasetsIcon',
  'DbIcon',
  'DebugIcon',
  'DeploymentIcon',
  'DividerIcon',
  'DocsIcon',
  'EnvIcon',
  'ExperimentsIcon',
  'FiltersIcon',
  'FolderIcon',
  'GithubCoinIcon',
  'GithubIcon',
  'GoogleIcon',
  'GroqIcon',
  'HomeIcon',
  'Icon',
  'InfoIcon',
  'JudgeIcon',
  'LatencyIcon',
  'LogsIcon',
  'MastraIcon',
  'McpCoinIcon',
  'McpServerIcon',
  'MemoryIcon',
  'MetricsIcon',
  'MistralIcon',
  'NetlifyIcon',
  'OpenaiChatIcon',
  'OpenAIIcon',
  'ProcessorIcon',
  'PromptIcon',
  'RepoIcon',
  'RequestContextIcon',
  'ScorersIcon',
  'SettingsIcon',
  'SkillIcon',
  'SlashIcon',
  'ToolCoinIcon',
  'ToolsIcon',
  'TraceIcon',
  'TsIcon',
  'VariablesIcon',
  'WorkflowCoinIcon',
  'WorkflowIcon',
  'WorkspacesIcon',
  'XGroqIcon',
];

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
    importNames: ['cn'],
    message: 'Import cn from @mastra/playground-ui/utils/cn.',
  },
  {
    importNames: [
      'is401UnauthorizedError',
      'is403ForbiddenError',
      'is404NotFoundError',
      'isBranchesNotSupportedError',
      'isUnsupportedObservabilityOperationError',
      'isNonRetryableError',
      'parseError',
    ],
    message: 'Import error helpers from @mastra/playground-ui/utils/errors.',
  },
  {
    importNames: ['shouldRetryQuery'],
    message: 'Import query helpers from @mastra/playground-ui/utils/query-utils.',
  },
  {
    importNames: ['JsonSchema', 'JsonSchemaProperty', 'JsonSchemaType'],
    message: 'Import JSON schema types from @mastra/playground-ui/utils/json-schema.',
  },
  {
    importNames: ['Rule', 'RuleGroup', 'ConditionOperator', 'countLeafRules'],
    message: 'Import rule-engine types and helpers from @mastra/playground-ui/utils/rule-engine.',
  },
  {
    importNames: ['truncateString'],
    message: 'Import truncateString from @mastra/playground-ui/utils/truncate-string.',
  },
  {
    importNames: ['stringToColor'],
    message: 'Import stringToColor from @mastra/playground-ui/utils/colors.',
  },
  {
    importNames: ['formatJSON', 'formatTypeScript', 'isValidJson'],
    message: 'Import formatting helpers from @mastra/playground-ui/utils/formatting.',
  },
  {
    importNames: [
      'fileToBase64',
      'getFileContentType',
      'isRemoteUrl',
      'isBrowserFetchableUrl',
      'isNonFetchableRemoteUrl',
    ],
    message: 'Import file helpers from @mastra/playground-ui/utils/file.',
  },
  {
    importNames: ['toSigFigs'],
    message: 'Import toSigFigs from @mastra/playground-ui/utils/number.',
  },
  {
    importNames: ['lodashTitleCase'],
    message: 'Import lodashTitleCase from @mastra/playground-ui/utils/string.',
  },
  {
    importNames: ['toast'],
    message: 'Import toast from @mastra/playground-ui/utils/toast.',
  },
  {
    importNames: playgroundUiIconImportNames,
    message: 'Import icons from @mastra/playground-ui/icons/<IconName>.',
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
    importNames: ['Button', 'ButtonProps'],
    message: 'Import Button exports from @mastra/playground-ui/components/Button.',
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
    importNames: ['Collapsible', 'CollapsibleContent', 'CollapsibleTrigger'],
    message: 'Import Collapsible exports from @mastra/playground-ui/components/Collapsible.',
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
    importNames: ['DataList', 'DataListSkeleton', 'ScoresDataList'],
    message: 'Import DataList exports from @mastra/playground-ui/components/DataList.',
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
    importNames: [
      'Dialog',
      'DialogPortal',
      'DialogOverlay',
      'DialogTrigger',
      'DialogClose',
      'DialogContent',
      'DialogHeader',
      'DialogFooter',
      'DialogBody',
      'DialogTitle',
      'DialogDescription',
    ],
    message: 'Import Dialog exports from @mastra/playground-ui/components/Dialog.',
  },
  {
    importNames: ['Entity', 'EntityContent', 'EntityName', 'EntityDescription', 'EntityIcon'],
    message: 'Import Entity exports from @mastra/playground-ui/components/Entity.',
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
    importNames: ['PageLayout', 'NoDataPageLayout', 'PageHeadingContext'],
    message: 'Import PageLayout exports from @mastra/playground-ui/components/PageLayout.',
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
    importNames: ['Popover', 'PopoverTrigger', 'PopoverContent', 'HoverPopover'],
    message: 'Import Popover exports from @mastra/playground-ui/components/Popover.',
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
    importNames: ['RuleBuilder', 'RuleBuilderProps'],
    message: 'Import RuleBuilder exports from @mastra/playground-ui/components/RuleBuilder.',
  },
  {
    importNames: ['Searchbar', 'SearchbarWrapper', 'SearchbarProps'],
    message: 'Import Searchbar exports from @mastra/playground-ui/components/Searchbar.',
  },
  {
    importNames: ['ScrollArea'],
    message: 'Import ScrollArea from @mastra/playground-ui/components/ScrollArea.',
  },
  {
    importNames: [
      'Select',
      'SelectGroup',
      'SelectValue',
      'SelectTrigger',
      'SelectContent',
      'SelectItem',
      'SelectValueProps',
      'SelectTriggerVariant',
      'SelectTriggerProps',
      'SelectContentProps',
      'SelectItemProps',
    ],
    message: 'Import Select exports from @mastra/playground-ui/components/Select.',
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
    importNames: ['Txt'],
    message: 'Import Txt from @mastra/playground-ui/components/Txt.',
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
    importNames: ['Tooltip', 'TooltipTrigger', 'TooltipContent', 'TooltipProvider'],
    message: 'Import Tooltip exports from @mastra/playground-ui/components/Tooltip.',
  },
  {
    importNames: ['Toaster'],
    message: 'Import Toaster from @mastra/playground-ui/components/Toaster.',
  },
  {
    importNames: ['Truncate', 'TruncateProps'],
    message: 'Import Truncate exports from @mastra/playground-ui/components/Truncate.',
  },
].flatMap(restriction =>
  restriction.importNames.flatMap(importName => [
    {
      selector: `ImportDeclaration[source.value="@mastra/playground-ui"] > ImportSpecifier[imported.name="${importName}"]`,
      message: restriction.message,
    },
    {
      selector: `ExportNamedDeclaration[source.value="@mastra/playground-ui"] > ExportSpecifier[local.name="${importName}"]`,
      message: restriction.message,
    },
  ]),
);

const PLAYGROUND_UI_ROOT_IMPORT_MESSAGE =
  'Import from an exact @mastra/playground-ui subpath instead of the root barrel.';

const restrictedPlaygroundUiRootSelectors = [
  {
    selector: 'ImportDeclaration[source.value="@mastra/playground-ui"]',
    message: PLAYGROUND_UI_ROOT_IMPORT_MESSAGE,
  },
  {
    selector: 'ExportNamedDeclaration[source.value="@mastra/playground-ui"]',
    message: PLAYGROUND_UI_ROOT_IMPORT_MESSAGE,
  },
  {
    selector: 'ExportAllDeclaration[source.value="@mastra/playground-ui"]',
    message: PLAYGROUND_UI_ROOT_IMPORT_MESSAGE,
  },
  {
    selector:
      'CallExpression[callee.object.name="vi"][callee.property.name="mock"] > Literal[value="@mastra/playground-ui"]:first-child',
    message: PLAYGROUND_UI_ROOT_IMPORT_MESSAGE,
  },
  {
    selector:
      'CallExpression[callee.object.name="vi"][callee.property.name="importActual"] > Literal[value="@mastra/playground-ui"]:first-child',
    message: PLAYGROUND_UI_ROOT_IMPORT_MESSAGE,
  },
];

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

// Enforce the Playwright E2E BDD shape, including modifier forms like `test.skip('...')`.
const E2E_BDD_MESSAGE =
  "E2E BDD: every test()/it() must live inside a test.describe('when …') precondition block. " +
  "Outer test.describe = the unit, inner test.describe('when …') = ONE precondition, each test = ONE outcome. " +
  'See the e2e-tests-studio skill.';

const testFunctionNames = new Set(['test', 'it']);
const testDeclarationModifiers = new Set(['skip', 'only', 'fixme', 'fail', 'slow']);

function isStaticTestTitle(node) {
  return (
    (node.type === 'Literal' && typeof node.value === 'string') ||
    (node.type === 'TemplateLiteral' && node.quasis.length >= 1)
  );
}

function isTestDeclarationCall(node) {
  if (node.type !== 'CallExpression') return false;

  const callee = node.callee;
  if (callee.type === 'Identifier' && testFunctionNames.has(callee.name)) return true;

  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    testDeclarationModifiers.has(callee.property.name) &&
    callee.object.type === 'Identifier' &&
    testFunctionNames.has(callee.object.name)
  ) {
    // Guard-style annotations like `test.skip(true, 'reason')` do not declare test cases.
    return isStaticTestTitle(node.arguments[0]);
  }

  return false;
}

/** True when a CallExpression is a `describe(...)`, `test.describe(...)`, or `it.describe(...)` call. */
function isDescribeCall(node) {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee.type === 'Identifier' && callee.name === 'describe') return true;
  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'describe' &&
    callee.object.type === 'Identifier' &&
    (callee.object.name === 'test' || callee.object.name === 'it')
  ) {
    return true;
  }
  return false;
}

/**
 * Extract the leading static text of a describe() first argument, or null.
 * For template literals with interpolation (e.g. `when the ${name} …`) we only
 * need the leading static quasi to verify the title starts with "when".
 */
function describeTitle(node) {
  const arg = node.arguments[0];
  if (!arg) return null;
  if (arg.type === 'Literal' && typeof arg.value === 'string') return arg.value;
  if (arg.type === 'TemplateLiteral' && arg.quasis.length >= 1) return arg.quasis[0].value.cooked;
  return null;
}

const e2eBddPlugin = {
  rules: {
    'test-needs-when-describe': {
      meta: {
        type: 'problem',
        docs: { description: 'Require test()/it() to be nested in a describe("when …") block.' },
        schema: [],
      },
      create(context) {
        return {
          CallExpression(node) {
            if (!isTestDeclarationCall(node)) return;
            // Walk ancestors to find the nearest enclosing describe.
            const ancestors = context.sourceCode.getAncestors(node);
            let nearestDescribe = null;
            for (let i = ancestors.length - 1; i >= 0; i--) {
              if (isDescribeCall(ancestors[i])) {
                nearestDescribe = ancestors[i];
                break;
              }
            }
            const title = nearestDescribe && describeTitle(nearestDescribe);
            if (!nearestDescribe || title == null || !/^when\b/.test(title)) {
              context.report({ node, message: E2E_BDD_MESSAGE });
            }
          },
        };
      },
    },
  },
};

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
  // Only the Playwright spec files under e2e/tests are linted (for BDD
  // structure enforcement below). The kitchen-sink app, test utils, config,
  // scripts, and build output under e2e remain unlinted as before.
  {
    ignores: [
      'e2e/kitchen-sink/**',
      'e2e/scripts/**',
      'e2e/playwright-report/**',
      'e2e/test-results/**',
      'e2e/playwright.config.ts',
      'e2e/tests/__utils__/**',
    ],
  },
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
      'no-restricted-syntax': [
        'error',
        ...restrictedPlaygroundUiRootSelectors,
        ...restrictedPlaygroundUiBarrelImportSpecifiers,
      ],
    },
  },
  {
    files: ['src/**/*.{test,spec}.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...restrictedPlaygroundUiRootSelectors,
        ...restrictedPlaygroundUiBarrelImportSpecifiers,
        ...restrictedTestMockSelectors,
      ],
    },
  },
  {
    // Playwright E2E specs: enforce the BDD structure described in the
    // e2e-tests-studio skill (every test()/it() nested in a describe('when …')).
    // These files are not part of the type-aware tsconfig program, so disable
    // the TypeScript project service here and only run the syntactic BDD rule.
    files: ['e2e/tests/**/*.spec.{js,jsx,ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: false,
      },
    },
    plugins: {
      'e2e-bdd': e2eBddPlugin,
    },
    rules: {
      // These specs are not part of a type-aware tsconfig program, so disable
      // the @typescript-eslint rules that require type information.
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'e2e-bdd/test-needs-when-describe': 'error',
    },
  },
];
