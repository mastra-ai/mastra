import React from 'react';
import type { ComponentType, ReactElement, ReactNode, SVGProps } from 'react';
import type { RouteObject } from 'react-router';
import { PuzzleIcon } from 'lucide-react';

import type { RouteHeaderHandle } from '@/lib/route-header';

export type StudioPluginIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface StudioPluginRoute {
  path: `/${string}`;
  component?: ComponentType;
  element?: ReactNode;
  handle?: RouteHeaderHandle;
}

export interface StudioPluginNavItem {
  name: string;
  url: `/${string}`;
  Icon?: StudioPluginIcon;
  activePaths?: string[];
  isOnMastraPlatform?: boolean;
}

export interface StudioPlugin {
  id: string;
  name?: string;
  routes?: StudioPluginRoute[];
  navItems?: StudioPluginNavItem[];
}

export interface StudioPluginNavSection {
  key: string;
  title: string;
  href?: string;
  items: Array<
    Required<Pick<StudioPluginNavItem, 'name' | 'url' | 'Icon' | 'isOnMastraPlatform'>> &
      Pick<StudioPluginNavItem, 'activePaths'>
  >;
}

interface StudioPluginHost {
  React: typeof React;
  plugins: StudioPlugin[];
  registerPlugin: (plugin: StudioPlugin) => void;
}

declare global {
  interface Window {
    MASTRA_STUDIO?: Partial<StudioPluginHost>;
  }
}

function ensureStudioPluginHost(): StudioPluginHost {
  const existingHost = window.MASTRA_STUDIO ?? {};
  const plugins = existingHost.plugins ?? [];
  const host: StudioPluginHost = {
    React,
    plugins,
    registerPlugin: registerStudioPlugin,
  };

  window.MASTRA_STUDIO = host;

  return host;
}

function pluginRouteElement(route: StudioPluginRoute): ReactNode {
  if (route.element) return route.element;
  if (!route.component) return null;

  const Component = route.component;
  return <Component />;
}

function pluginRouteHandle(plugin: StudioPlugin, route: StudioPluginRoute): RouteHeaderHandle {
  if (route.handle) return route.handle;

  const matchingNavItem = plugin.navItems?.find(item => item.url === route.path);
  const label = matchingNavItem?.name ?? plugin.name ?? plugin.id;
  const Icon = matchingNavItem?.Icon ?? PuzzleIcon;

  return {
    crumbs: [{ id: `plugin:${plugin.id}:${route.path}`, label, icon: Icon }],
  };
}

/**
 * Registers an external Studio plugin before the Studio router is created.
 */
export function registerStudioPlugin(plugin: StudioPlugin): void {
  const host = ensureStudioPluginHost();
  const existingIndex = host.plugins.findIndex(registeredPlugin => registeredPlugin.id === plugin.id);

  if (existingIndex >= 0) {
    host.plugins[existingIndex] = plugin;
    return;
  }

  host.plugins.push(plugin);
}

/**
 * Returns the Studio plugins registered on the current browser window.
 */
export function getStudioPlugins(): readonly StudioPlugin[] {
  return ensureStudioPluginHost().plugins;
}

/**
 * Returns registered plugin routes in the shape expected by React Router.
 */
export function getStudioPluginRoutes(): RouteObject[] {
  return getStudioPlugins().flatMap(plugin =>
    (plugin.routes ?? []).map(route => ({
      path: route.path,
      element: pluginRouteElement(route) as ReactElement,
      handle: pluginRouteHandle(plugin, route),
    })),
  );
}

/**
 * Returns a sidebar section containing all registered plugin navigation items.
 */
export function getStudioPluginNavSections(): StudioPluginNavSection[] {
  const items = getStudioPlugins().flatMap(plugin => plugin.navItems ?? []);

  if (items.length === 0) return [];

  return [
    {
      key: 'studio-plugins',
      title: 'Plugins',
      items: items.map(item => ({
        ...item,
        Icon: item.Icon ?? PuzzleIcon,
        isOnMastraPlatform: item.isOnMastraPlatform ?? true,
      })),
    },
  ];
}

/**
 * Clears registered plugins between tests.
 */
export function resetStudioPluginsForTests(): void {
  ensureStudioPluginHost().plugins.splice(0);
}
