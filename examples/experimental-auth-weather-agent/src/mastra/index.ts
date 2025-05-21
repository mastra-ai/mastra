import { Mastra } from '@mastra/core';
import { defineAuth } from '@mastra/core/server';
import { createClient } from '@supabase/supabase-js';

import { weatherAgent } from './agents';
import { weatherWorkflow } from './workflows';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export const mastra = new Mastra({
  agents: { weatherAgent },
  workflows: { weatherWorkflow },
  server: {
    experimental_auth: defineAuth({
      async authenticateToken(token, request) {
        const { data, error } = await supabase.auth.getUser(token);

        if (error) {
          return null;
        }

        return data.user;
      },
      async authorize(request, method, user) {
        // Get user data from Supabase
        const { data, error } = await supabase.from('users').select('isAdmin').eq('id', user?.id).single();

        if (error) {
          return false;
        }

        const isAdmin = data?.isAdmin;

        // Check permissions based on role
        return isAdmin;
      },
    }),
  },
});
