import { expect, it } from 'vitest'
import type { ApiType } from './model'
import { typeContent } from './type-content'

const reference: ApiType = {
  kind: 'reference',
  display: 'Payload',
  attributes: {},
  operands: [],
  target: { id: 'payload', name: 'Payload', boundary: 'data' },
}
it('links structured references without changing type text or linking literals', () => {
  const type: ApiType = {
    kind: 'union',
    display: 'Payload | "Payload"',
    attributes: {},
    operands: [
      { role: '0', type: reference },
      { role: '1', type: { kind: 'literal', display: '"Payload"', operands: [], attributes: {} } },
    ],
  }
  expect(typeContent(type, new Map([['payload', '#api-payload']]))).toEqual([
    { kind: 'link', href: '#api-payload', children: [{ kind: 'text', value: 'Payload' }] },
    { kind: 'text', value: ' | "Payload"' },
  ])
  expect(typeContent(type, new Map())).toEqual([{ kind: 'text', value: type.display }])
})
it('leaves ambiguous same-name declarations unlinked', () => {
  const other: ApiType = { ...reference, target: { id: 'other', name: 'Payload', boundary: 'data' } }
  const type: ApiType = {
    kind: 'union',
    display: 'Payload | Payload',
    attributes: {},
    operands: [
      { role: '0', type: reference },
      { role: '1', type: other },
    ],
  }
  expect(
    typeContent(
      type,
      new Map([
        ['payload', '#api-payload'],
        ['other', '#api-other'],
      ]),
    ),
  ).toEqual([{ kind: 'text', value: type.display }])
})
