// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getStudioPluginNavSections,
  getStudioPluginRoutes,
  registerStudioPlugin,
  resetStudioPluginsForTests,
} from './plugins';

function CounterPage() {
  return <p>Counter plugin</p>;
}

function CounterIcon() {
  return <svg aria-hidden="true" />;
}

afterEach(() => {
  resetStudioPluginsForTests();
});

describe('Studio plugin registry', () => {
  it('exposes registered plugin routes as React Router route objects', () => {
    registerStudioPlugin({
      id: 'counter',
      name: 'Counter tools',
      routes: [{ path: '/counter', component: CounterPage }],
    });

    const [route] = getStudioPluginRoutes();

    expect(route.path).toBe('/counter');
    expect(renderToStaticMarkup(route.element)).toContain('Counter plugin');
  });

  it('exposes registered plugin nav items under a Studio plugins section', () => {
    registerStudioPlugin({
      id: 'counter',
      name: 'Counter tools',
      navItems: [{ name: 'Counter', url: '/counter', Icon: CounterIcon }],
    });

    expect(getStudioPluginNavSections()).toEqual([
      {
        key: 'studio-plugins',
        title: 'Plugins',
        items: [{ name: 'Counter', url: '/counter', Icon: CounterIcon, isOnMastraPlatform: true }],
      },
    ]);
  });
});
