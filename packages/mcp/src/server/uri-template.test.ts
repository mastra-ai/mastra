import { describe, expect, it } from 'vitest';
import { matchesUriTemplate } from './uri-template';

describe('matchesUriTemplate', () => {
  it.each([
    ['file://data/{id}', 'file://data/123', true],
    ['file://data/{id}', 'file://data/a/b', false],
    ['file://data/{id}', 'file://data/', false],
    ['weather://{city}', 'weather://berlin?admin=true', false],
    ['weather://{city}', 'xweather://berlin', false],
    ['weather://{city}', 'weather://s%C3%A3o%20paulo', true],
    ['weather://{city}', 'weather://münchen', true],
    ['file://data/{id}F', 'file://data/%2F', false],
    ['file://data/{id}', 'file://data/%2', false],
    ['file://data{?format}', 'file://data?format=a/b', false],
    ['file://data{?ids}', 'file://data?ids=1,2', true],
    ['file://data/{+path}', 'file://data/a/b', true],
    ['file://{name}.{ext}', 'file://my.report.pdf', true],
    ['users://{id}{/sub}', 'users://1/profile', true],
    ['users://{id}{/sub}', 'users://1', true],
    ['users://{id}{/sub}', 'users://1/', true],
    ['repo://{owner}{/path*}', 'repo://me/src/index.ts', true],
    ['file://data{?tags*}', 'file://data?tags=a&tags=b', true],
    ['file://data{;tags*}', 'file://data;tags=a;tags=b', true],
    ['file://data/{id}{?format}', 'file://data/123?format=', true],
    ['file://data/{id}{?format,lang}', 'file://data/123', true],
    ['file://data/{id}{?format,lang}', 'file://data/123?format=json&lang=en', true],
    ['file://data/{id}{?format,lang}', 'file://data/123?lang=en', true],
    ['file://data/{id}{?format,lang}', 'file://data/123?other=1', false],
    ['file://data/{id}{?format,lang}', 'file://data/123?format=a?lang=b', false],
    ['file://data{?format}', 'file://data&format=json', false],
    ['file://data{?format}{&lang}', 'file://data?format=a&lang=b', true],
    ['doc://{id}{#section}', 'doc://1#intro', true],
    ['x://{a}-{b}-{c}-{d}', 'x://1-2-3-4', true],
  ])('%s against %s -> %s', (template, uri, expected) => {
    expect(matchesUriTemplate(template, uri)).toBe(expected);
  });

  // A backtracking regex takes minutes on this input; the test timeout catches a regression.
  it('rejects a long non-matching URI against adjacent variables in linear time', () => {
    expect(matchesUriTemplate('x://{a}-{b}-{c}-{d}', `x://${'a-'.repeat(50_000)}/`)).toBe(false);
    expect(matchesUriTemplate('x://d{?t*}', `x://d?${'t=a&'.repeat(50_000)}/`)).toBe(false);
  });
});
