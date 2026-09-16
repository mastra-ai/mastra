import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

export interface RequestContextSchemaFormRenderProps {
  /** Serialized JSON schema, as provided by the server for the entity. */
  requestContextSchema: string;
  defaultValues: Record<string, unknown>;
  /** Called on every change; the surrounding run options persist the values on "Save". */
  onValuesChange: (values: Record<string, unknown>) => void;
}

export type RequestContextSchemaFormRenderer = (props: RequestContextSchemaFormRenderProps) => ReactNode;

const SchemaFormRendererContext = createContext<RequestContextSchemaFormRenderer | null>(null);

export interface RequestContextSchemaFormRendererProviderProps {
  render: RequestContextSchemaFormRenderer;
  children: ReactNode;
}

/**
 * Injects the form implementation used by `RequestContextSchemaForm`.
 * Mount once at the app root; the host app owns JSON-schema → form rendering.
 */
export function RequestContextSchemaFormRendererProvider({
  render,
  children,
}: RequestContextSchemaFormRendererProviderProps) {
  return <SchemaFormRendererContext.Provider value={render}>{children}</SchemaFormRendererContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider and its hook intentionally share this module
export function useRequestContextSchemaFormRenderer() {
  return useContext(SchemaFormRendererContext);
}
