export function rewriteSpecifier(specifier: string, resolveSuffix: (spec: string) => string | null): string | null;

export function rewriteRelativeSpecifiers(source: string, resolveSuffix: (spec: string) => string | null): string;

export function createFilesystemResolver(fromDir: string): (specifier: string) => string | null;
