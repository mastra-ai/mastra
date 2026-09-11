import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Application, DeclarationReflection, FileRegistry, normalizePath, UnknownType } from 'typedoc'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseContract } from '../../src/api-reference/schema'
import { normalize } from './normalize'

const fixture = `
/** Recursive data, not a service. */
export interface Item<T = string> {
  /** The item value. */
  readonly value: T;
  /** Optional string. */
  optional?: string;
  /** Required field that can be undefined. */
  explicit: string | undefined;
  /** Next item. */
  next?: Item<T>;
  /**
   * Defaulted value.
   * @defaultValue "fallback"
   */
  defaulted?: string;
  /** @deprecated Use value instead. */
  old?: T;
  /** @internal */
  hidden?: string;
}
/** Alias to instantiated data. */
export type Alias = Item<number>;
export type Mapped<T> = { [Key in keyof T]: Item<T[Key]> };
export type Conditional<T> = T extends string ? Item<T> : Item<number>;
/** Data can use class syntax without becoming a service. */
export class DataObject {
  /** Public value. */
  publicValue = 'value';
  private secret = 'secret';
  protected protectedValue = 'hidden';
}
/** Public fixture. */
export interface Fixture<T = unknown> {
  alias: Alias;
  classData: DataObject;
  genericMapped: Mapped<T>;
  conditional: Conditional<T>;
  callback: (value: Item<number>) => Promise<Item<string>>;
  intersection: Item<string> & { extra: boolean };
  union: Item<string> | Item<number>;
  mapped: { [Key in 'first' | 'second']: Item<Key> };
  indexed: Item<number>['value'];
  template: \`prefix-\${'one' | 'two'}\`;
  tuple: [first: string, second?: number, ...rest: boolean[]];
}
`

describe('normalized API contract', () => {
  let directory: string
  let conversion: Awaited<ReturnType<typeof createFixture>>
  async function createFixture() {
    directory = await mkdtemp(path.join(os.tmpdir(), 'mastra-api-normalization-'))
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: '@mastra/core', version: '0.0.0' }))
    await writeFile(path.join(directory, 'fixture.ts'), fixture)
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { strict: true, skipLibCheck: true, target: 'ES2023' },
        files: ['fixture.ts'],
      }),
    )
    const app = await Application.bootstrap({
      entryPoints: [path.join(directory, 'fixture.ts')],
      tsconfig: path.join(directory, 'tsconfig.json'),
      basePath: directory,
      excludeInternal: true,
      excludePrivate: true,
      excludeProtected: true,
    })
    const project = await app.convert()
    if (!project) throw new Error('Fixture conversion failed')
    const root = project.children?.find(child => child.name === 'Fixture')
    if (!root) throw new Error('Fixture root missing')
    return { app, project, root }
  }
  beforeAll(async () => {
    conversion = await createFixture()
  }, 60_000)
  afterAll(async () => {
    if (directory) await rm(directory, { recursive: true, force: true })
  })

  it('preserves aliases, generic arguments, recursion, callbacks and structured type expressions', () => {
    const contract = normalize(conversion.project, conversion.root, '@mastra/core!Fixture')
    const nodes = Object.values(contract.declarations)
    expect(nodes.find(node => node.name === 'Alias')?.type?.display).toBe('Item<number>')
    expect(nodes.find(node => node.name === 'callback')?.type?.kind).toBe('reflection')
    expect(nodes.find(node => node.name === 'intersection')?.type?.kind).toBe('intersection')
    expect(nodes.find(node => node.name === 'Mapped')?.type?.kind).toBe('mapped')
    expect(nodes.find(node => node.name === 'Conditional')?.type?.kind).toBe('conditional')
    const mapped = nodes.find(node => node.name === 'mapped')?.type?.declaration
    expect(mapped && contract.declarations[mapped]?.children.map(id => contract.declarations[id]?.name)).toEqual([
      'first',
      'second',
    ])
    expect(nodes.find(node => node.name === 'indexed')?.type?.display).toBeTruthy()
    expect(nodes.find(node => node.name === 'tuple')?.type?.kind).toBe('tuple')
    const item = nodes.find(node => node.name === 'Item')
    expect(item).toBeDefined()
    const next = nodes.find(node => node.name === 'next')
    expect(next?.type?.target?.id).toBe(item?.id)
    expect(nodes.filter(node => node.name === 'Item')).toHaveLength(1)
    expect(nodes.some(node => node.name === 'hidden')).toBe(false)
    expect(nodes.find(node => node.name === 'old')?.comment?.tags.some(tag => tag.name === '@deprecated')).toBe(true)
    expect(nodes.find(node => node.name === 'value')?.flags).toContain('isReadonly')
  })

  it('expands data classes while excluding private and protected members and preserving defaults', () => {
    const contract = normalize(conversion.project, conversion.root, '@mastra/core!Fixture')
    const nodes = Object.values(contract.declarations)
    expect(nodes.find(node => node.name === 'classData')?.type?.target?.boundary).toBe('data')
    expect(nodes.find(node => node.name === 'DataObject')?.kind).toBe('Class')
    expect(nodes.find(node => node.name === 'publicValue')?.defaultValue).toBe("'value'")
    expect(nodes.some(node => node.name === 'secret' || node.name === 'protectedValue')).toBe(false)
    const defaultTag = nodes
      .find(node => node.name === 'defaulted')
      ?.comment?.tags.find(tag => tag.name === '@defaultValue')
    expect(defaultTag?.content).toEqual([{ kind: 'code', text: '```ts\n"fallback"\n```' }])
  })

  it('distinguishes optional fields from required fields containing undefined', () => {
    const contract = normalize(conversion.project, conversion.root, '@mastra/core!Fixture')
    const nodes = Object.values(contract.declarations)
    expect(nodes.find(node => node.name === 'optional')?.flags).toContain('isOptional')
    expect(nodes.find(node => node.name === 'explicit')?.flags).not.toContain('isOptional')
    expect(nodes.find(node => node.name === 'explicit')?.type?.display).toContain('undefined')
  })

  it('is independent of numeric reflection IDs after JSON serialization and revival', () => {
    const { app, project, root } = conversion
    const raw = app.serializer.projectToObject(project, normalizePath(directory))
    const revived = app.deserializer.reviveProject(project.name, raw, {
      projectRoot: normalizePath(directory),
      registry: new FileRegistry(),
    })
    const revivedRoot = revived.children?.find(child => child.name === 'Fixture')
    if (!revivedRoot) throw new Error('Revived root missing')
    expect(revivedRoot.id).not.toBe(root.id)
    expect(normalize(revived, revivedRoot, '@mastra/core!Fixture')).toEqual(
      normalize(project, root, '@mastra/core!Fixture'),
    )
  })

  it('allows missing descriptions during extraction but rejects unsupported required shapes', () => {
    const contract = normalize(conversion.project, conversion.root, '@mastra/core!Fixture')
    expect(Object.values(contract.declarations).some(node => !node.comment?.summary.length)).toBe(true)
    const property = conversion.root.children?.find(child => child.name === 'alias')
    if (!(property instanceof DeclarationReflection)) throw new Error('Fixture alias missing')
    const original = property.type
    try {
      property.type = new UnknownType('unsupported expression')
      expect(() => normalize(conversion.project, conversion.root, '@mastra/core!Fixture')).toThrow(
        'Unsupported required type',
      )
    } finally {
      property.type = original
    }
  })

  it('rejects incompatible versions and dangling declaration references', () => {
    const contract = normalize(conversion.project, conversion.root, '@mastra/core!Fixture')
    expect(() => parseContract({ ...contract, version: 2 })).toThrow()
    expect(() => parseContract({ ...contract, root: 'missing' })).toThrow()
    const invalid = structuredClone(contract)
    invalid.declarations[invalid.root]!.children.push('missing')
    expect(() => parseContract(invalid)).toThrow()
  })
})
