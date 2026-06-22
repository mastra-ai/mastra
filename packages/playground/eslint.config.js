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
    importNames: ['Combobox', 'ComboboxOption', 'ComboboxProps'],
    message: 'Import Combobox exports from @mastra/playground-ui/components/Combobox.',
  },
  {
    importNames: ['MetricsKpiCard'],
    message: 'Import MetricsKpiCard from @mastra/playground-ui/components/MetricsKpiCard.',
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
    importNames: ['SideDialog', 'SideDialogRootProps'],
    message: 'Import SideDialog exports from @mastra/playground-ui/components/SideDialog.',
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
