import { createHash } from 'node:crypto';
import { types as t } from '@babel/core';
import type { NodePath, PluginObject, PluginPass, Scope } from '@babel/core';

type Binding = NonNullable<ReturnType<Scope['getBinding']>>;

export interface ExtractedToolUIComponent {
  id: string;
  /** Absolute path of the module that imports the component */
  importer: string;
  /** Import specifier as written in the importer */
  source: string;
  /** Exported name in `source`, `default` for default imports */
  exportName: string;
}

export interface ExtractToolUIOptions {
  onComponent: (component: ExtractedToolUIComponent) => void;
  onWarning?: (message: string) => void;
}

export function getToolUIComponentId(importer: string, source: string, exportName: string) {
  return createHash('sha1').update(`${importer}\0${source}\0${exportName}`).digest('hex').slice(0, 16);
}

function getKeyName(node: t.ObjectProperty['key']) {
  if (t.isIdentifier(node)) return node.name;
  if (t.isStringLiteral(node)) return node.value;
  return undefined;
}

function getExportName(specifier: t.Node) {
  if (t.isImportDefaultSpecifier(specifier)) return 'default';
  if (t.isImportSpecifier(specifier)) {
    return t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value;
  }
  return undefined;
}

/**
 * Replaces `ui: { studioComponent: ImportedComponent }` with an opaque string id and drops the
 * import, so browser-only component code never ends up in the server bundle.
 */
export function extractToolUI({ onComponent, onWarning }: ExtractToolUIOptions): PluginObject<PluginPass> {
  // Number of `studioComponent` references replaced per import binding
  let replacedBindings = new Map<Binding, number>();

  return {
    name: 'extract-tool-ui',
    visitor: {
      Program: {
        enter() {
          replacedBindings = new Map();
        },
        exit() {
          for (const [binding, replacedCount] of replacedBindings) {
            if (binding.referencePaths.length > replacedCount) {
              continue;
            }

            const declaration = binding.path.parentPath as NodePath<t.ImportDeclaration>;
            binding.path.remove();
            if (declaration.node.specifiers.length === 0) {
              declaration.remove();
            }
          }
        },
      },
      ObjectProperty(path, state) {
        if (getKeyName(path.node.key) !== 'studioComponent' || path.node.computed) {
          return;
        }

        const uiProperty = path.parentPath.parentPath;
        if (
          !uiProperty?.isObjectProperty() ||
          uiProperty.node.computed ||
          getKeyName(uiProperty.node.key) !== 'ui' ||
          uiProperty.node.value !== path.parent
        ) {
          return;
        }

        const filename = state.filename ?? 'unknown';
        const value = path.node.value;
        if (t.isStringLiteral(value)) {
          return;
        }

        const binding = t.isIdentifier(value) ? path.scope.getBinding(value.name) : undefined;
        const exportName = binding?.kind === 'module' ? getExportName(binding.path.node) : undefined;
        const declaration = binding?.path.parentPath?.node;

        if (!binding || !exportName || !t.isImportDeclaration(declaration)) {
          onWarning?.(
            `[Mastra] Skipping \`ui.studioComponent\` in ${filename}: the component must be imported from a separate module (e.g. \`import { MyToolUI } from './my-tool-ui'\`). Studio will use the default tool UI.`,
          );
          return;
        }

        const source = declaration.source.value;
        const id = getToolUIComponentId(filename, source, exportName);
        onComponent({ id, importer: filename, source, exportName });

        path.get('value').replaceWith(t.stringLiteral(id));

        replacedBindings.set(binding, (replacedBindings.get(binding) ?? 0) + 1);
      },
    },
  };
}
