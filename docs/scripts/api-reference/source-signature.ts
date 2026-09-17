import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type { ApiSource } from '../../src/api-reference/model'
import { repositoryRoot } from './config'

export function createSourceSignatureReader() {
  const files = new Map<string, ts.SourceFile>()
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })

  /** True when the annotation writes out its own object body, as opposed to naming a declared type. */
  function hasAnonymousBody(node: ts.TypeNode): boolean {
    if (ts.isTypeLiteralNode(node)) return true
    if (ts.isParenthesizedTypeNode(node)) return hasAnonymousBody(node.type)
    return ts.isIntersectionTypeNode(node) && node.types.some(hasAnonymousBody)
  }

  return (source: ApiSource, typeOf?: string): { text: string; anonymousBody: boolean } | undefined => {
    let file = files.get(source.path)
    if (!file) {
      const filename = path.join(repositoryRoot, source.path)
      file = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
      files.set(source.path, file)
    }
    const sourceFile = file
    const position = sourceFile.getPositionOfLineAndCharacter(source.line - 1, source.character)
    function find(node: ts.Node): { text: string; anonymousBody: boolean } | undefined {
      if (position < node.getStart(sourceFile) || position >= node.end) return undefined
      if (
        typeOf &&
        (ts.isMethodDeclaration(node) ||
          ts.isFunctionDeclaration(node) ||
          ts.isMethodSignature(node) ||
          ts.isCallSignatureDeclaration(node) ||
          ts.isFunctionTypeNode(node))
      ) {
        const parameter = node.parameters.find(parameter => parameter.name.getText(sourceFile) === typeOf)
        if (parameter?.type)
          return {
            text: printer.printNode(ts.EmitHint.Unspecified, parameter.type, sourceFile).trim(),
            anonymousBody: hasAnonymousBody(parameter.type),
          }
      }
      if (
        typeOf &&
        (ts.isParameter(node) ||
          ts.isPropertySignature(node) ||
          ts.isPropertyDeclaration(node) ||
          ts.isTypeAliasDeclaration(node) ||
          ts.isVariableDeclaration(node)) &&
        node.name.getText(sourceFile) === typeOf &&
        node.type
      ) {
        return {
          text: printer.printNode(ts.EmitHint.Unspecified, node.type, sourceFile).trim(),
          anonymousBody: hasAnonymousBody(node.type),
        }
      }
      if (!typeOf && (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) && !node.body) {
        return {
          text: printer.printNode(ts.EmitHint.Unspecified, node, sourceFile).trim(),
          anonymousBody: false,
        }
      }
      return ts.forEachChild(node, find)
    }
    return find(sourceFile)
  }
}
