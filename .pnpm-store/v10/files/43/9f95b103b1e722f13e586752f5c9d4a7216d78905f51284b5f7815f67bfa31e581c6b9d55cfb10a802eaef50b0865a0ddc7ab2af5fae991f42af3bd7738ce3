import { CoercingContext } from '../types'
import { StringCoercer } from './string-coercer'

describe('PromiseRejectionEventCoercer', () => {
  const coercer = new StringCoercer()

  it('should parse string', () => {
    const infos = coercer.getInfos('My house is on fire')
    expect(infos).toMatchObject([undefined, 'My house is on fire'])
  })

  it('should parse errors', () => {
    const infos = coercer.getInfos('ReferenceError: My house is on fire')
    expect(infos).toMatchObject(['ReferenceError', 'My house is on fire'])
  })

  it('should discard prefix', () => {
    const infos = coercer.getInfos('Uncaught exception: ReferenceError: My house is on fire')
    expect(infos).toMatchObject(['ReferenceError', 'My house is on fire'])
  })

  it('should not match other patterns', () => {
    const infos = coercer.getInfos('ValueError: ReferenceError: My house is on fire')
    expect(infos).toMatchObject([undefined, 'ValueError: ReferenceError: My house is on fire'])
  })
})
