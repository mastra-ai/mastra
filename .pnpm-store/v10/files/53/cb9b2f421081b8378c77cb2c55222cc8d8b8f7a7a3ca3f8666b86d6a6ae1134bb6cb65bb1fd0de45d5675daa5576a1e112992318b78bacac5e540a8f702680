/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * This file is automatically synchronized from @supabase/postgrest-js
 * Source: packages/core/postgrest-js/src/types/common/
 *
 * To update this file, modify the source in postgrest-js and run:
 *   npm run codegen
 */

// Types that are shared between supabase-js and postgrest-js

export type Fetch = typeof fetch

export type GenericRelationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne?: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export type GenericTable = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: GenericRelationship[]
}

export type GenericUpdatableView = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: GenericRelationship[]
}

export type GenericNonUpdatableView = {
  Row: Record<string, unknown>
  Relationships: GenericRelationship[]
}

export type GenericView = GenericUpdatableView | GenericNonUpdatableView

export type GenericSetofOption = {
  isSetofReturn?: boolean | undefined
  isOneToOne?: boolean | undefined
  isNotNullable?: boolean | undefined
  to: string
  from: string
}

export type GenericFunction = {
  Args: Record<string, unknown> | never
  Returns: unknown
  SetofOptions?: GenericSetofOption
}

export type GenericSchema = {
  Tables: Record<string, GenericTable>
  Views: Record<string, GenericView>
  Functions: Record<string, GenericFunction>
}

export type ClientServerOptions = {
  PostgrestVersion?: string
}
