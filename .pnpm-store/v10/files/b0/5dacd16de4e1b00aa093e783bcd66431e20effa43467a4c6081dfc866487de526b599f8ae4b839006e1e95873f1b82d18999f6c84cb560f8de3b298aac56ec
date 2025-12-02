import { ErrorPropertiesBuilder } from './error-properties-builder'
import { chromeStackLineParser } from './parsers'
import { StackFrame } from './types'

describe('ErrorPropertiesBuilder', () => {
  describe('coerceUnknown', () => {
    const errorPropertiesBuilder = new ErrorPropertiesBuilder([], [chromeStackLineParser], [])

    function parseStack(error: Error): StackFrame[] | undefined {
      const ctx = {}
      const exception = errorPropertiesBuilder.parseStacktrace(
        {
          type: 'Error',
          value: 'Whatever',
          stack: error.stack,
          synthetic: false,
        },
        ctx
      )
      return exception.stack
    }

    it('should parse stacktraces', () => {
      const syntheticError = new Error()
      const frames = parseStack(syntheticError)
      expect(frames).toBeDefined()
      expect(frames).toHaveLength(16)
    })
  })
})
