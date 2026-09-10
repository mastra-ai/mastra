// AUTO-GENERATED — do not edit by hand.
// Updated by the maintainer-only add-provider and remove-provider commands.
import type { ProviderRegistration } from '../registry.js';

import { anthropicProvider } from './anthropic/index.js';
import { linearProvider } from './linear/index.js';
import { notionProvider } from './notion/index.js';
import { openaiProvider } from './openai/index.js';
import { supabaseProvider } from './supabase/index.js';

export const PROVIDERS: readonly ProviderRegistration[] = [
  anthropicProvider,
  linearProvider,
  notionProvider,
  openaiProvider,
  supabaseProvider,
];
