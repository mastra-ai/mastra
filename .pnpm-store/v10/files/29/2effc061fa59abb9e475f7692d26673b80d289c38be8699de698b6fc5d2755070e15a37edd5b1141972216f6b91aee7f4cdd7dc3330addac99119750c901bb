import { StorageApiError, StorageUnknownError } from './errors'
import { isPlainObject, resolveResponse } from './helpers'
import { FetchParameters } from './types'

export type Fetch = typeof fetch

export interface FetchOptions {
  headers?: {
    [key: string]: string
  }
  duplex?: string
  noResolveJson?: boolean
}

export type RequestMethodType = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD'

const _getErrorMessage = (err: any): string =>
  err.msg || err.message || err.error_description || err.error || JSON.stringify(err)

const handleError = async (
  error: unknown,
  reject: (reason?: any) => void,
  options?: FetchOptions
) => {
  const Res = await resolveResponse()

  if (error instanceof Res && !options?.noResolveJson) {
    error
      .json()
      .then((err) => {
        const status = error.status || 500
        const statusCode = err?.statusCode || status + ''
        reject(new StorageApiError(_getErrorMessage(err), status, statusCode))
      })
      .catch((err) => {
        reject(new StorageUnknownError(_getErrorMessage(err), err))
      })
  } else {
    reject(new StorageUnknownError(_getErrorMessage(error), error))
  }
}

const _getRequestParams = (
  method: RequestMethodType,
  options?: FetchOptions,
  parameters?: FetchParameters,
  body?: object
) => {
  const params: { [k: string]: any } = { method, headers: options?.headers || {} }

  if (method === 'GET' || !body) {
    return params
  }

  if (isPlainObject(body)) {
    params.headers = { 'Content-Type': 'application/json', ...options?.headers }
    params.body = JSON.stringify(body)
  } else {
    params.body = body
  }

  if (options?.duplex) {
    params.duplex = options.duplex
  }

  return { ...params, ...parameters }
}

async function _handleRequest(
  fetcher: Fetch,
  method: RequestMethodType,
  url: string,
  options?: FetchOptions,
  parameters?: FetchParameters,
  body?: object
): Promise<any> {
  return new Promise((resolve, reject) => {
    fetcher(url, _getRequestParams(method, options, parameters, body))
      .then((result) => {
        if (!result.ok) throw result
        if (options?.noResolveJson) return result
        return result.json()
      })
      .then((data) => resolve(data))
      .catch((error) => handleError(error, reject, options))
  })
}

export async function get(
  fetcher: Fetch,
  url: string,
  options?: FetchOptions,
  parameters?: FetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'GET', url, options, parameters)
}

export async function post(
  fetcher: Fetch,
  url: string,
  body: object,
  options?: FetchOptions,
  parameters?: FetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'POST', url, options, parameters, body)
}

export async function put(
  fetcher: Fetch,
  url: string,
  body: object,
  options?: FetchOptions,
  parameters?: FetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'PUT', url, options, parameters, body)
}

export async function head(
  fetcher: Fetch,
  url: string,
  options?: FetchOptions,
  parameters?: FetchParameters
): Promise<any> {
  return _handleRequest(
    fetcher,
    'HEAD',
    url,
    {
      ...options,
      noResolveJson: true,
    },
    parameters
  )
}

export async function remove(
  fetcher: Fetch,
  url: string,
  body: object,
  options?: FetchOptions,
  parameters?: FetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'DELETE', url, options, parameters, body)
}
