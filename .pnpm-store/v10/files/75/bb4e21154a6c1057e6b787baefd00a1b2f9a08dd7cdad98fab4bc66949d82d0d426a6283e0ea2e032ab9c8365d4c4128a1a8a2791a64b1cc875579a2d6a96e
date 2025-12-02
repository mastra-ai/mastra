import { FetchLike } from '../types'

export * from './bucketed-rate-limiter'
export * from './number-utils'
export * from './string-utils'
export * from './type-utils'
export * from './promise-queue'

export const STRING_FORMAT = 'utf8'

export function assert(truthyValue: any, message: string): void {
  if (!truthyValue || typeof truthyValue !== 'string' || isEmpty(truthyValue)) {
    throw new Error(message)
  }
}

function isEmpty(truthyValue: string): boolean {
  if (truthyValue.trim().length === 0) {
    return true
  }
  return false
}

export function removeTrailingSlash(url: string): string {
  return url?.replace(/\/+$/, '')
}

export interface RetriableOptions {
  retryCount: number
  retryDelay: number
  retryCheck: (err: unknown) => boolean
}

export async function retriable<T>(fn: () => Promise<T>, props: RetriableOptions): Promise<T> {
  let lastError = null

  for (let i = 0; i < props.retryCount + 1; i++) {
    if (i > 0) {
      // don't wait when it's the last try
      await new Promise<void>((r) => setTimeout(r, props.retryDelay))
    }

    try {
      const res = await fn()
      return res
    } catch (e) {
      lastError = e
      if (!props.retryCheck(e)) {
        throw e
      }
    }
  }

  throw lastError
}

export function currentTimestamp(): number {
  return new Date().getTime()
}

export function currentISOTime(): string {
  return new Date().toISOString()
}

export function safeSetTimeout(fn: () => void, timeout: number): any {
  // NOTE: we use this so rarely that it is totally fine to do `safeSetTimeout(fn, 0)``
  // rather than setImmediate.
  const t = setTimeout(fn, timeout) as any
  // We unref if available to prevent Node.js hanging on exit
  t?.unref && t?.unref()
  return t
}

// NOTE: We opt for this slightly imperfect check as the global "Promise" object can get mutated in certain environments
export const isPromise = (obj: any): obj is Promise<any> => {
  return obj && typeof obj.then === 'function'
}

export const isError = (x: unknown): x is Error => {
  return x instanceof Error
}

export function getFetch(): FetchLike | undefined {
  return typeof fetch !== 'undefined' ? fetch : typeof globalThis.fetch !== 'undefined' ? globalThis.fetch : undefined
}

export function allSettled<T>(
  promises: (Promise<T> | null | undefined)[]
): Promise<({ status: 'fulfilled'; value: T } | { status: 'rejected'; reason: any })[]> {
  return Promise.all(
    promises.map((p) =>
      (p ?? Promise.resolve()).then(
        (value: any) => ({ status: 'fulfilled' as const, value }),
        (reason: any) => ({ status: 'rejected' as const, reason })
      )
    )
  )
}
