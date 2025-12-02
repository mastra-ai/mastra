import { buildLocalBinaryPaths } from './utils'

describe('buildLocalBinaryPaths', () => {
  it('generates possible binary locations', () => {
    const cwd = '/home/user'
    const result = buildLocalBinaryPaths(cwd)
    expect(result.includes('/home/user/node_modules/.bin')).toBe(true)
    expect(result.includes('/home/node_modules/.bin')).toBe(true)
    expect(result.includes('/node_modules/.bin')).toBe(true)
  })
})
