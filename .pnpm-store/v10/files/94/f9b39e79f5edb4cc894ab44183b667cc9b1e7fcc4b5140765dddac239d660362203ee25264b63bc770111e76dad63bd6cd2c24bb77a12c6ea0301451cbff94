import MagicString from 'magic-string';
import { findStaticImports, parseStaticImport, findExports } from 'mlly';

function internalFixDefaultCJSExports(code, info, options) {
  const parsedExports = extractExports(code, info, options);
  if (!parsedExports) {
    return;
  }
  if (parsedExports.defaultExport.specifier) {
    const imports = [];
    for (const imp of findStaticImports(code)) {
      if (!imp.imports) {
        continue;
      }
      imports.push(parseStaticImport(imp));
    }
    const specifier = parsedExports.defaultExport.specifier;
    const defaultImport = imports.find((i) => i.specifier === specifier);
    return parsedExports.defaultExport._type === "named" ? handleDefaultNamedCJSExport(
      code,
      info,
      parsedExports,
      imports,
      options,
      defaultImport
    ) : handleDefaultCJSExportAsDefault(
      code,
      parsedExports,
      imports,
      defaultImport
    ) || handleNoSpecifierDefaultCJSExport(code, info, parsedExports);
  }
  return handleNoSpecifierDefaultCJSExport(code, info, parsedExports);
}
function extractExports(code, info, options) {
  const defaultExport = findExports(code).find(
    (e) => e.names.includes("default")
  );
  if (!defaultExport) {
    options.warn?.(
      /* c8 ignore next */
      `No default export found in ${info.fileName}, it contains default export but cannot be parsed.`
    );
    return;
  }
  const match = defaultExport.code.match(/export\s*\{([^}]*)\}/);
  if (!match?.length) {
    options.warn?.(
      `No default export found in ${info.fileName}, it contains default export but cannot be parsed.`
    );
    return;
  }
  let defaultAlias;
  const exportsEntries = [];
  for (const exp of match[1].split(",").map((e) => e.trim())) {
    if (exp === "default") {
      defaultAlias = exp;
      continue;
    }
    const m = exp.match(/\s*as\s+default\s*/);
    if (m) {
      defaultAlias = exp.replace(m[0], "");
    } else {
      exportsEntries.push(exp);
    }
  }
  if (!defaultAlias) {
    options.warn?.(
      `No default export found in ${info.fileName}, it contains default export but cannot be parsed.`
    );
    return;
  }
  return {
    defaultExport,
    defaultAlias,
    exports: exportsEntries
  };
}
function handleDefaultCJSExportAsDefault(code, { defaultExport, exports }, imports, defaultImport) {
  if (defaultImport) {
    return exports.length === 0 ? code.replace(
      defaultExport.code,
      `export = ${defaultImport.defaultImport}`
    ) : code.replace(
      defaultExport.code,
      `// @ts-ignore
export = ${defaultImport.defaultImport};
export { ${exports.join(", ")} } from '${defaultExport.specifier}'`
    );
  } else {
    const magicString = new MagicString(code);
    const lastImportPosition = imports.length > 0 ? imports.at(-1)?.end || 0 : 0;
    if (lastImportPosition > 0) {
      magicString.appendRight(
        lastImportPosition,
        `
import _default from '${defaultExport.specifier}';
`
      );
    } else {
      magicString.prepend(
        `import _default from '${defaultExport.specifier}';
`
      );
    }
    return exports.length > 0 ? magicString.replace(
      defaultExport.code,
      `// @ts-ignore
export = _default;
export { ${exports.join(", ")} } from '${defaultExport.specifier}'`
    ).toString() : magicString.replace(defaultExport.code, "export = _default").toString();
  }
}
function handleDefaultNamedCJSExport(code, info, parsedExports, imports, options, defaultImport) {
  const { defaultAlias, defaultExport, exports } = parsedExports;
  if (defaultAlias === "default") {
    if (defaultImport && !defaultImport.defaultImport) {
      options.warn?.(
        `Cannot parse default export name from ${defaultImport.specifier} import at ${info.fileName}!.`
      );
      return;
    }
    return handleDefaultCJSExportAsDefault(
      code,
      parsedExports,
      imports,
      defaultImport
    );
  }
  if (defaultImport) {
    const namedExports = defaultImport.namedImports;
    if (namedExports?.[defaultAlias] === defaultAlias) {
      return exports.length === 0 ? code.replace(defaultExport.code, `export = ${defaultAlias}`) : code.replace(
        defaultExport.code,
        `// @ts-ignore
export = ${defaultAlias};
export { ${exports.join(", ")} }`
      );
    } else {
      options.warn?.(
        `Cannot parse "${defaultAlias}" named export from ${defaultImport.specifier} import at ${info.fileName}!.`
      );
      return void 0;
    }
  }
  const magicString = new MagicString(code);
  const lastImportPosition = imports.length > 0 ? imports.at(-1)?.end || 0 : 0;
  if (lastImportPosition > 0) {
    magicString.appendRight(
      lastImportPosition,
      `
import { ${defaultAlias} } from '${defaultExport.specifier}';
`
    );
  } else {
    magicString.prepend(
      `import { ${defaultAlias} } from '${defaultExport.specifier}';
`
    );
  }
  return exports.length > 0 ? magicString.replace(
    defaultExport.code,
    `// @ts-ignore
export = ${defaultAlias};
export { ${exports.join(", ")} } from '${defaultExport.specifier}'`
  ).toString() : magicString.replace(defaultExport.code, `export = ${defaultAlias}`).toString();
}
function handleNoSpecifierDefaultCJSExport(code, info, { defaultAlias, defaultExport, exports }) {
  let exportStatement = exports.length > 0 ? void 0 : "";
  if (exportStatement === void 0) {
    let someExternalExport = false;
    const typeExportRegexp = /\s*type\s+/;
    const allRemainingExports = exports.map((exp) => {
      if (someExternalExport) {
        return [exp, ""];
      }
      if (!info.imports.includes(exp)) {
        const m = exp.match(typeExportRegexp);
        if (m) {
          const name = exp.replace(m[0], "").trim();
          if (!info.imports.includes(name)) {
            return [exp, name];
          }
        }
      }
      someExternalExport = true;
      return [exp, ""];
    });
    exportStatement = someExternalExport ? `;
export { ${allRemainingExports.map(([e, _]) => e).join(", ")} }` : `;
export type { ${allRemainingExports.map(([_, t]) => t).join(", ")} }`;
  }
  return code.replace(
    defaultExport.code,
    `${exportStatement.length > 0 ? "// @ts-ignore\n" : ""}export = ${defaultAlias}${exportStatement}`
  );
}

export { internalFixDefaultCJSExports as i };
