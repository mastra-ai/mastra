// Compatibility re-export for backwards compatibility
// RuntimeContext has been renamed to RequestContext
// This file provides backwards compatibility for packages still using the old import path

export { RequestContext as RuntimeContext } from '../request-context';
export type { RequestContext } from '../request-context';
