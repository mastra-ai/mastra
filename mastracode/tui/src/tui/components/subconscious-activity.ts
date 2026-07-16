import { Container, Text } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, mastra, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';

const MAX_UPDATES = 10;
const MAX_HOT = 10;
const MAX_ERRORS = 10;
const DISPLAY_UPDATES = 4;
const DISPLAY_HOT = 4;
const DISPLAY_ERRORS = 3;

interface SubconsciousActivityUpdate {
  id: string;
  action: string;
  type: 'entity' | 'fact' | 'page';
  recordId: string;
  name?: string;
  targetId: string;
  targetType: 'entity' | 'page';
  sourceThreadId?: string;
  createdAt: string;
}

interface SubconsciousHotRecord {
  type: 'entity' | 'page';
  id: string;
  name: string;
  updates: number;
}

export interface SubconsciousActivitySnapshot {
  updates: SubconsciousActivityUpdate[];
  hot: SubconsciousHotRecord[];
  errors?: string[];
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function string(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function update(value: unknown): SubconsciousActivityUpdate | undefined {
  const item = object(value);
  if (
    !item ||
    !string(item.id) ||
    !string(item.action) ||
    !['entity', 'fact', 'page'].includes(String(item.type)) ||
    !string(item.recordId) ||
    !string(item.targetId) ||
    !['entity', 'page'].includes(String(item.targetType)) ||
    !string(item.createdAt) ||
    (item.name !== undefined && typeof item.name !== 'string') ||
    (item.sourceThreadId !== undefined && typeof item.sourceThreadId !== 'string')
  ) {
    return undefined;
  }
  return item as unknown as SubconsciousActivityUpdate;
}

function hotRecord(value: unknown): SubconsciousHotRecord | undefined {
  const item = object(value);
  if (
    !item ||
    !['entity', 'page'].includes(String(item.type)) ||
    !string(item.id) ||
    !string(item.name) ||
    typeof item.updates !== 'number' ||
    !Number.isFinite(item.updates) ||
    item.updates < 0
  ) {
    return undefined;
  }
  return item as unknown as SubconsciousHotRecord;
}

export function parseSubconsciousActivitySnapshot(value: unknown): SubconsciousActivitySnapshot | undefined {
  const snapshot = object(value);
  if (!snapshot || !Array.isArray(snapshot.updates) || !Array.isArray(snapshot.hot)) return undefined;
  if (snapshot.updates.length > MAX_UPDATES || snapshot.hot.length > MAX_HOT) return undefined;
  if (snapshot.errors !== undefined && (!Array.isArray(snapshot.errors) || snapshot.errors.length > MAX_ERRORS)) {
    return undefined;
  }

  const updates = snapshot.updates.map(update);
  const hot = snapshot.hot.map(hotRecord);
  const errors = snapshot.errors?.map(error => (typeof error === 'string' ? error : undefined));
  if (updates.some(item => !item) || hot.some(item => !item) || errors?.some(error => error === undefined)) {
    return undefined;
  }
  return {
    updates: updates as SubconsciousActivityUpdate[],
    hot: hot as SubconsciousHotRecord[],
    ...(errors?.length ? { errors: errors as string[] } : {}),
  };
}

export class SubconsciousActivityComponent extends Container {
  constructor(snapshot: SubconsciousActivitySnapshot) {
    super();
    const errorCount = snapshot.errors?.length ?? 0;
    const summary = `${snapshot.updates.length} update${snapshot.updates.length === 1 ? '' : 's'} · ${snapshot.hot.length} hot${errorCount ? ` · ${errorCount} error${errorCount === 1 ? '' : 's'}` : ''}`;
    this.addChild(new Text(chalk.hex(mastra.blue).bold('Subconscious knowledge'), BOX_INDENT, 0));
    this.addChild(new Text(theme.fg('dim', summary), BOX_INDENT + 2, 0));

    for (const item of snapshot.updates.slice(0, DISPLAY_UPDATES)) {
      const target = item.name ?? item.recordId;
      this.addChild(new Text(`${item.action}: ${target}`, BOX_INDENT + 2, 0));
    }
    if (snapshot.updates.length > DISPLAY_UPDATES) {
      this.addChild(
        new Text(theme.fg('muted', `+${snapshot.updates.length - DISPLAY_UPDATES} more updates`), BOX_INDENT + 2, 0),
      );
    }

    if (snapshot.hot.length) {
      const names = snapshot.hot
        .slice(0, DISPLAY_HOT)
        .map(item => `${item.name} (${item.updates})`)
        .join(', ');
      this.addChild(new Text(theme.fg('dim', `Hot: ${names}`), BOX_INDENT + 2, 0));
    }

    for (const error of snapshot.errors?.slice(0, DISPLAY_ERRORS) ?? []) {
      this.addChild(new Text(theme.fg('error', `Error: ${error}`), BOX_INDENT + 2, 0));
    }
    if (errorCount > DISPLAY_ERRORS) {
      this.addChild(new Text(theme.fg('muted', `+${errorCount - DISPLAY_ERRORS} more errors`), BOX_INDENT + 2, 0));
    }
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}
