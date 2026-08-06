import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import ts from 'typescript';

/**
 * Dev-time identity helper for zod schemas that are compiled away by esbuildCompileZod.
 *
 * @template T
 * @param {T} schema
 * @returns {T}
 */
export function compileSchema(schema) {
  return schema;
}

const COMPILE_ZOD_MODULE = '@internal/types-builder/compile-zod';
const require = createRequire(import.meta.url);
let zod;

function getZod() {
  zod ??= require('zod/v4');
  return zod;
}

/**
 * @param {import('typescript').Expression} expression
 * @param {import('typescript').SourceFile} sourceFile
 */
function evaluateZodExpression(expression, sourceFile) {
  const expr = expression.getText(sourceFile).replace(/,\s*$/, '');
  const schema = new Function('z', `return (${expr});`)(getZod());
  const standard = schema?.['~standard'];
  const jsonSchema = standard?.jsonSchema?.input?.();

  if (!jsonSchema) {
    throw new Error(`compileSchema() argument did not produce a zod Standard Schema JSON schema: ${expr}`);
  }

  return JSON.stringify(jsonSchema, null, 2);
}

/**
 * @param {import('typescript').ImportSpecifier} specifier
 */
function isCompileSchemaImportSpecifier(specifier) {
  if ((specifier.propertyName?.text ?? specifier.name.text) !== 'compileSchema') {
    return false;
  }

  const namedImports = specifier.parent;
  const importClause = namedImports.parent;
  const importDeclaration = importClause.parent;
  const moduleSpecifier = importDeclaration.moduleSpecifier;

  return ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === COMPILE_ZOD_MODULE;
}

/**
 * @param {import('typescript').SourceFile} sourceFile
 */
function findCompileSchemaImportSpecifiers(sourceFile) {
  /** @type {Map<string, import('typescript').ImportSpecifier>} */
  const specifiers = new Map();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }

    const namedBindings = statement.importClause?.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      continue;
    }

    for (const element of namedBindings.elements) {
      if (isCompileSchemaImportSpecifier(element)) {
        specifiers.set(element.name.text, element);
      }
    }
  }

  return specifiers;
}

/**
 * @param {import('typescript').BindingName | undefined} bindingName
 * @param {string} name
 */
function bindingNameContains(bindingName, name) {
  if (!bindingName) {
    return false;
  }

  if (ts.isIdentifier(bindingName)) {
    return bindingName.text === name;
  }

  return bindingName.elements.some(element => bindingNameContains(element.name, name));
}

/**
 * @param {import('typescript').Node} node
 * @param {string} name
 */
function declaresValueName(node, name) {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.some(declaration => bindingNameContains(declaration.name, name));
  }

  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) {
    return node.name?.text === name;
  }

  if (ts.isImportDeclaration(node)) {
    const namedBindings = node.importClause?.namedBindings;
    return (
      !!namedBindings &&
      ts.isNamedImports(namedBindings) &&
      namedBindings.elements.some(element => element.name.text === name)
    );
  }

  return false;
}

/**
 * @param {import('typescript').Identifier} identifier
 * @param {import('typescript').SourceFile} sourceFile
 * @param {Map<string, import('typescript').ImportSpecifier>} importSpecifiers
 */
function isImportBinding(identifier, sourceFile, importSpecifiers) {
  const localName = identifier.text;
  const importedSpecifier = importSpecifiers.get(localName);

  if (!importedSpecifier) {
    return false;
  }

  let current = identifier.parent;
  while (current && current !== sourceFile) {
    if (ts.isFunctionLike(current)) {
      if (current.parameters.some(parameter => bindingNameContains(parameter.name, localName))) {
        return false;
      }

      if ((ts.isFunctionExpression(current) || ts.isClassExpression(current)) && current.name?.text === localName) {
        return false;
      }
    }

    if (
      (ts.isBlock(current) || ts.isModuleBlock(current)) &&
      current.statements.some(statement => declaresValueName(statement, localName))
    ) {
      return false;
    }

    current = current.parent;
  }

  const topLevelDeclarations = sourceFile.statements.filter(
    statement => statement !== importedSpecifier.parent.parent.parent,
  );
  return !topLevelDeclarations.some(statement => declaresValueName(statement, localName));
}

/**
 * @param {import('typescript').SourceFile} sourceFile
 * @param {Map<string, import('typescript').ImportSpecifier>} importSpecifiers
 */
function findCompileSchemaCalls(sourceFile, importSpecifiers) {
  /** @type {{ start: number; end: number; replacement: string }[]} */
  const replacements = [];

  /** @param {import('typescript').Node} node */
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      isImportBinding(node.expression, sourceFile, importSpecifiers) &&
      node.arguments.length === 1
    ) {
      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        replacement: evaluateZodExpression(node.arguments[0], sourceFile),
      });
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return replacements;
}

/**
 * @param {import('typescript').SourceFile} sourceFile
 */
function findCompileSchemaImportEdits(sourceFile) {
  /** @type {{ start: number; end: number; replacement: string }[]} */
  const replacements = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }

    const moduleSpecifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier) || moduleSpecifier.text !== COMPILE_ZOD_MODULE) {
      continue;
    }

    const namedBindings = statement.importClause?.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      continue;
    }

    const compileSpecifier = namedBindings.elements.find(isCompileSchemaImportSpecifier);
    if (!compileSpecifier) {
      continue;
    }

    if (namedBindings.elements.length === 1 && !statement.importClause?.name) {
      replacements.push({ start: statement.getFullStart(), end: statement.getEnd(), replacement: '' });
      continue;
    }

    const index = namedBindings.elements.indexOf(compileSpecifier);
    const start = compileSpecifier.getFullStart();
    let end = compileSpecifier.getEnd();

    if (index < namedBindings.elements.length - 1) {
      const next = namedBindings.elements[index + 1];
      end = next.getFullStart();
    } else {
      const previous = namedBindings.elements[index - 1];
      replacements.push({ start: previous.getEnd(), end, replacement: '' });
      continue;
    }

    replacements.push({ start, end, replacement: '' });
  }

  return replacements;
}

/**
 * @param {string} code
 * @param {string} path
 */
function transform(code, path) {
  const scriptKind = path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, scriptKind);
  const importSpecifiers = findCompileSchemaImportSpecifiers(sourceFile);
  const replacements = [
    ...findCompileSchemaCalls(sourceFile, importSpecifiers),
    ...findCompileSchemaImportEdits(sourceFile),
  ];

  if (!replacements.length) {
    return code;
  }

  return replacements
    .sort((a, b) => b.start - a.start)
    .reduce((result, edit) => result.slice(0, edit.start) + edit.replacement + result.slice(edit.end), code);
}

export default function esbuildCompileZod() {
  return {
    name: 'compile-zod',
    setup(build) {
      build.onLoad({ filter: /\.[cm]?tsx?$/ }, async args => {
        const contents = await fs.readFile(args.path, 'utf8');

        if (!contents.includes('compileSchema')) {
          return null;
        }

        return {
          contents: transform(contents, args.path),
          loader: args.path.endsWith('x') ? 'tsx' : 'ts',
        };
      });
    },
  };
}
