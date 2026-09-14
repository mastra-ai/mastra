import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type { ApiSource } from '../../src/api-reference/model'
import { repositoryRoot } from './config'

export function createSourceSignatureReader() {
  const files = new Map<string, ts.SourceFile>()
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })

  return (source: ApiSource, typeOf?: string): string | undefined => {
    let file = files.get(source.path)
    if (!file) {
      const filename = path.join(repositoryRoot, source.path)
      file = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
      files.set(source.path, file)
    }
    const sourceFile = file
    const position = sourceFile.getPositionOfLineAndCharacter(source.line - 1, source.character)
    function find(node: ts.Node): string | undefined {
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
        if (parameter?.type) return printer.printNode(ts.EmitHint.Unspecified, parameter.type, sourceFile).trim()
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
        return printer.printNode(ts.EmitHint.Unspecified, node.type, sourceFile).trim()
      }
      if (!typeOf && (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) && !node.body) {
        return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile).trim()
      }
      return ts.forEachChild(node, find)
    }
    return find(sourceFile)
  }
}
