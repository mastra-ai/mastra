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
    importNames: ['Truncate', 'TruncateProps'],
    message: 'Import Truncate exports from @mastra/playground-ui/components/Truncate.',
  },
].flatMap(restriction =>
  restriction.importNames.map(importName => ({
    selector: `ImportDeclaration[source.value="@mastra/playground-ui"] > ImportSpecifier[imported.name="${importName}"]`,
    message: restriction.message,
  })),
);

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
];
