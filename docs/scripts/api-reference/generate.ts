import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { format } from 'oxfmt'
import {
  Application,
  Context,
  Converter,
  FileRegistry,
  ReflectionKind,
  Type,
  makeRecursiveVisitor,
  normalizePath,
  type ProjectReflection,
  type ReferenceType,
  type Reflection,
} from 'typedoc'
import ts from 'typescript'
import formatting from '../../.oxfmtrc.json'
import {
  artifactDirectory,
  entryPoints,
  ownedPackages,
  repositoryRoot,
  roots,
  serviceClassifications,
  symbolIdentity,
} from './config'
import { normalize } from './normalize'

export function selectRoots(project: ProjectReflection) {
  return roots.map(root => {
    const matches = Object.values(project.reflections).filter(
      reflection =>
        reflection.name === root.name &&
        (root.parent
          ? reflection.parent?.name === root.parent && reflection.kindOf(ReflectionKind.Method)
          : reflection.kindOf(ReflectionKind.Interface)),
    )
    if (matches.length !== 1) throw new Error(`Expected one public ${root.id}; found ${matches.length}`)
    return { ...root, reflection: matches[0]! }
  })
}

export async function convertPilot() {
  const app = await Application.bootstrap({
    entryPoints: entryPoints.map(entry => path.join(repositoryRoot, entry)),
    tsconfig: path.join(repositoryRoot, 'packages/core/tsconfig.json'),
    compilerOptions: {
      lib: ['DOM', 'DOM.Iterable', 'DOM.AsyncIterable', 'ES2023'],
      paths: {
        '@internal/auth': [path.join(repositoryRoot, 'packages/_internals/auth/src/index.ts')],
        '@internal/auth/*': [
          path.join(repositoryRoot, 'packages/_internals/auth/src/*'),
          path.join(repositoryRoot, 'packages/_internals/auth/src/*/index.ts'),
        ],
      },
    },
    basePath: repositoryRoot,
    excludePrivate: true,
    excludeProtected: true,
    excludeInternal: true,
  })
  const convertType = app.converter.convertType.bind(app.converter)
  app.converter.convertType = (context, type: ts.Type | ts.TypeNode | undefined, node?: ts.TypeNode) => {
    const annotation = node ?? (type && 'kind' in type ? type : undefined)
    if (annotation && ts.isIndexedAccessTypeNode(annotation) && ts.isTypeReferenceNode(annotation.objectType)) {
      const symbol = context.getSymbolAtLocation(annotation.objectType.typeName)
      const identity = symbol && context.createSymbolId(context.resolveAliasedSymbol(symbol))
      if (identity && ownedPackages.has(identity.packageName)) {
        const resolved = context.checker.getTypeFromTypeNode(annotation)
        if (!(resolved.flags & ts.TypeFlags.IndexedAccess)) return convertType(context, resolved)
      }
    }
    const referenceNode =
      node &&
      (ts.isTypeReferenceNode(node)
        ? node
        : ts.isIndexedAccessTypeNode(node) && ts.isTypeReferenceNode(node.objectType)
          ? node.objectType
          : undefined)
    const localAnnotation =
      node &&
      [...ownedPackages.values()].some(directory =>
        node.getSourceFile().fileName.startsWith(path.join(repositoryRoot, directory, 'src/')),
      )
    if (node && referenceNode && localAnnotation) {
      let generic = false
      function inspect(child: ts.Node) {
        if (
          ts.isTypeReferenceNode(child) &&
          context.getSymbolAtLocation(child.typeName)?.flags === ts.SymbolFlags.TypeParameter
        )
          generic = true
        ts.forEachChild(child, inspect)
      }
      inspect(node)
      if (!generic) return convertType(context, node)
    }
    return type && 'kind' in type ? convertType(context, type) : convertType(context, type, node)
  }
  const references = new Map<ReferenceType, { symbol: ts.Symbol; program: ts.Program }>()
  const original = Context.prototype.createSymbolReference
  // TypeDoc 0.28.20 exposes this seam for missing-export adapters. Restore it even
  // when conversion fails; no runtime Mastra modules are loaded by this adapter.
  Context.prototype.createSymbolReference = function (symbol, context, name) {
    const reference = original.call(this, symbol, context, name)
    references.set(reference, { symbol, program: context.program })
    return reference
  }
  app.converter.on(
    Converter.EVENT_RESOLVE_BEGIN,
    context => {
      const visited = new Set<Reflection>()
      let owner = ''
      const route: string[] = []
      const visitor = makeRecursiveVisitor({
        reference(reference) {
          if (reference.refersToTypeParameter || reference.isIntentionallyBroken()) return
          const match = references.get(reference)
          const identity = match
            ? context.createSymbolId(match.symbol)
            : (reference.symbolId ??
              (reference.reflection && context.project.getSymbolIdFromReflection(reference.reflection)))
          if (!identity || !ownedPackages.has(identity.packageName)) return
          const key = symbolIdentity(identity.packageName, identity.packagePath, identity.qualifiedName)
          let reflection = reference.reflection
          if (!reflection && match) {
            context.setActiveProgram(match.program)
            app.converter.convertSymbol(context, match.symbol)
            reflection = context.getReflectionFromSymbol(match.symbol)
          }
          if (!reflection) throw new Error(`Required owned declaration could not be converted: ${key}`)
          if (!serviceClassifications.has(key)) visit(reflection)
        },
        reflection(type) {
          visit(type.declaration)
        },
        unknown(type) {
          throw new Error(`Unsupported required type at ${owner}: ${type.toString()}\nVia: ${route.join(' -> ')}`)
        },
      })
      function visit(reflection: Reflection) {
        if (visited.has(reflection)) return
        visited.add(reflection)
        const previousOwner = owner
        owner = reflection.getFullName()
        route.push(owner)
        if ('type' in reflection && reflection.type instanceof Type) reflection.type.visit(visitor)
        if ('default' in reflection && reflection.default instanceof Type) reflection.default.visit(visitor)
        reflection.traverse(child => {
          visit(child)
        })
        route.pop()
        owner = previousOwner
      }
      selectRoots(context.project).forEach(root => visit(root.reflection))
      context.setActiveProgram(undefined)
      // Run before built-in source/comment resolution so newly converted declarations
      // receive the same visibility filtering, relative paths and link resolution.
    },
    10_000,
  )
  try {
    const project = await app.convert()
    if (!project || app.logger.hasErrors()) throw new Error('TypeDoc conversion failed')
    app.validate(project)
    const raw = app.serializer.projectToObject(project, normalizePath(repositoryRoot))
    const serializedProject = app.deserializer.reviveProject(project.name, raw, {
      projectRoot: normalizePath(repositoryRoot),
      registry: new FileRegistry(),
    })
    return { app, project: serializedProject, raw }
  } finally {
    Context.prototype.createSymbolReference = original
  }
}

export async function generate(outputDirectory = artifactDirectory) {
  const { project } = await convertPilot()
  const contracts = selectRoots(project).map(root => ({
    file: root.file,
    contract: normalize(project, root.reflection, root.id),
  }))
  const output = path.resolve(outputDirectory)
  await mkdir(path.dirname(output), { recursive: true })
  const staging = await mkdtemp(`${output}.staging-`)
  const previous = `${staging}.previous`
  let movedPrevious = false
  try {
    for (const { file, contract } of contracts) {
      const result = await format(file, JSON.stringify(contract, undefined, 2), {
        printWidth: formatting.printWidth,
        tabWidth: formatting.tabWidth,
        useTabs: formatting.useTabs,
        bracketSpacing: formatting.bracketSpacing,
      })
      if (result.errors.length)
        throw new Error(`Could not format ${file}: ${result.errors.map(error => error.message).join('; ')}`)
      await writeFile(path.join(staging, file), result.code)
    }
    try {
      await rename(output, previous)
      movedPrevious = true
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    }
    try {
      await rename(staging, output)
    } catch (error) {
      if (movedPrevious) await rename(previous, output)
      throw error
    }
    if (movedPrevious) await rm(previous, { recursive: true })
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
  return contracts
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  if (args.length && (args.length !== 2 || args[0] !== '--output-dir' || !args[1])) {
    throw new Error('Usage: generate.ts [--output-dir DIRECTORY]')
  }
  const start = performance.now()
  const contracts = await generate(args[1])
  console.log(`Generated ${contracts.length} API contracts in ${((performance.now() - start) / 1000).toFixed(2)}s`)
}
