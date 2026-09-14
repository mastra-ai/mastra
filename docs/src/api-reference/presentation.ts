import type { ApiSection } from './traversal'

export type CommentNode =
  | { kind: 'text'; value: string }
  | { kind: 'code'; value: string; language?: string; npm2yarn?: boolean }
  | { kind: 'tabs'; items: { value: string; label: string; content: CommentNode[] }[] }
  | { kind: 'link'; href: string; children: CommentNode[] }
  | {
      kind: 'element'
      tag: 'p' | 'strong' | 'em' | 'code' | 'ul' | 'ol' | 'li' | 'blockquote' | 'br' | 'h4' | 'h5' | 'h6'
      children: CommentNode[]
    }

export interface ApiEntry {
  id: string
  name: string
  label?: string
  path?: string
  table?: 'Parameter' | 'Property'
  inlineObject?: boolean
  variantKey?: string
  variantValue?: string
  variantDiscriminator?: string
  signature?: string
  callSummary?: string
  kind?: string
  returnValue?: boolean
  defaultType?: string
  type?: string
  typeContent?: CommentNode[]
  parameterDefinition?: { id: string; context: string }
  optional: boolean
  description: CommentNode[]
  deprecated: CommentNode[]
  defaults: CommentNode[]
  examples: CommentNode[][]
  source?: string
  sourceUrl?: string
  descriptionRequired?: boolean
  nested?: ApiItem[]
}

export type ApiItem = ApiEntry | { target: string; name: string }

export interface ApiSurface {
  externalHeading?: boolean
  section: ApiSection
  id: string
  title: string
  entries: ApiEntry[]
  definitions?: ApiEntry[]
  appendix?: { href: string; title: string }
}

export function memberAnchor(id: string): string {
  return `api-${id.replace(/[^a-zA-Z0-9-]/g, character => `_${character.charCodeAt(0).toString(16)}_`)}`
}
