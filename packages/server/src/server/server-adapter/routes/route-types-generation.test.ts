import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { renderRouteTypesFileContent, type RouteDefinition } from '../../../../scripts/generate-route-types';

function renderFixtureRoutes(routes: readonly RouteDefinition[]): string {
  return renderRouteTypesFileContent(routes);
}

describe('renderRouteTypesFileContent', () => {
  it('renders request schemas with input semantics and responses with output semantics', () => {
    const schema = z.object({
      limit: z.coerce.number().optional().default(10),
      label: z.string().default('default'),
    });

    const rendered = renderFixtureRoutes([
      {
        method: 'POST',
        path: '/fixtures/:id',
        responseType: 'json',
        pathParamSchema: z.object({ id: z.string() }),
        queryParamSchema: schema,
        bodySchema: schema,
        responseSchema: schema,
        handler: async () => ({}),
      },
    ]);

    expect(rendered).toContain(`export type PostFixturesId_QueryParams = {
    limit?: number | undefined;
    label?: string;
};`);
    expect(rendered).toContain('export type PostFixturesId_Body = PostFixturesId_QueryParams;');
    expect(rendered).toContain(`export type PostFixturesId_Response = {
    limit: number | undefined;
    label: string;
};`);
    expect(rendered).not.toContain('export type PostFixturesId_Response = PostFixturesId_QueryParams;');
  });

  it('keeps deterministic coerced and preprocessed request schemas concrete', () => {
    const schema = z.object({
      coerced: z.coerce.number(),
      preprocessed: z.preprocess(value => Number(value), z.number()),
    });

    const rendered = renderFixtureRoutes([
      {
        method: 'POST',
        path: '/coercion',
        responseType: 'json',
        bodySchema: schema,
        responseSchema: schema,
        handler: async () => ({}),
      },
    ]);

    expect(rendered).toContain(`export type PostCoercion_Body = {
    coerced: number;
    preprocessed?: number;
};`);
    expect(rendered).toContain(`export type PostCoercion_Response = {
    coerced: number;
    preprocessed: number;
};`);
    expect(rendered).not.toContain('coerced?: unknown');
    expect(rendered).not.toContain('preprocessed?: unknown');
  });

  it('promotes repeated nested schemas during the rendering pass', () => {
    const nestedSchema = z.object({
      first: z.string(),
      second: z.string(),
      third: z.string(),
      fourth: z.string(),
      fifth: z.string(),
      sixth: z.string(),
      seventh: z.string(),
      eighth: z.string(),
    });

    const rendered = renderFixtureRoutes([
      {
        method: 'POST',
        path: '/nested',
        responseType: 'json',
        responseSchema: z.object({ first: nestedSchema, second: nestedSchema }),
        handler: async () => ({}),
      },
    ]);

    expect(rendered).toContain('type Shared_Type_0 = {');
    expect(rendered).toContain('first: Shared_Type_0;');
    expect(rendered).toContain('second: Shared_Type_0;');
  });

  it('does not cross-deduplicate shared schemas between input and output aliases', () => {
    const sharedSchema = z.object({ value: z.string().default('default') });

    const rendered = renderFixtureRoutes([
      {
        method: 'POST',
        path: '/first',
        responseType: 'json',
        bodySchema: sharedSchema,
        responseSchema: sharedSchema,
        handler: async () => ({}),
      },
      {
        method: 'POST',
        path: '/second',
        responseType: 'json',
        bodySchema: sharedSchema,
        responseSchema: sharedSchema,
        handler: async () => ({}),
      },
    ]);

    expect(rendered).toContain('export type PostFirst_Body = {');
    expect(rendered).toContain('export type PostSecond_Body = PostFirst_Body;');
    expect(rendered).toContain('export type PostFirst_Response = {');
    expect(rendered).toContain('export type PostSecond_Response = PostFirst_Response;');
    expect(rendered).not.toContain('export type PostFirst_Response = PostFirst_Body;');
  });
});
