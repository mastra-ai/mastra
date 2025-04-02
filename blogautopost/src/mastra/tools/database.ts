import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアントの初期化
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// カテゴリ取得ツール
export const getCategoriesToolDef = createTool({
  id: 'getCategoriesToolDef',
  description: 'Get all categories from the database',
  inputSchema: z.object({}),
  outputSchema: z.array(z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
  })),
  execute: async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*');
    
    if (error) {
      throw new Error(`Error fetching categories: ${error.message}`);
    }
    
    return data || [];
  },
});

// カテゴリ作成ツール
export const createCategoryToolDef = createTool({
  id: 'createCategoryToolDef',
  description: 'Create a new category in the database',
  inputSchema: z.object({
    name: z.string().describe('The name of the category'),
    slug: z.string().describe('The slug of the category'),
    description: z.string().optional().describe('The description of the category'),
  }),
  outputSchema: z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
  }),
  execute: async ({ context }) => {
    const { name, slug, description } = context;
    
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name, slug, description }])
      .select()
      .single();
    
    if (error) {
      throw new Error(`Error creating category: ${error.message}`);
    }
    
    return data;
  },
});

// 記事保存ツール
export const saveArticleToolDef = createTool({
  id: 'saveArticleToolDef',
  description: 'Save an article to the database',
  inputSchema: z.object({
    title: z.string().describe('The title of the article'),
    content: z.string().describe('The content of the article in markdown format'),
    category_id: z.number().describe('The ID of the category'),
    status: z.enum(['draft', 'published']).default('draft').describe('The status of the article'),
    keywords: z.string().optional().describe('Keywords for the article'),
    meta_title: z.string().optional().describe('Meta title for SEO'),
    meta_desc: z.string().optional().describe('Meta description for SEO'),
  }),
  outputSchema: z.object({
    id: z.number(),
    title: z.string(),
    status: z.string(),
    created_at: z.string(),
  }),
  execute: async ({ context }) => {
    const { 
      title, 
      content, 
      category_id, 
      status, 
      keywords, 
      meta_title, 
      meta_desc 
    } = context;
    
    // 現在の日時を取得（記事が公開の場合）
    const published_at = status === 'published' ? new Date().toISOString() : null;
    
    const { data, error } = await supabase
      .from('articles')
      .insert([{
        title,
        content,
        category_id,
        status,
        keywords,
        meta_title,
        meta_desc,
        published_at
      }])
      .select('id, title, status, created_at')
      .single();
    
    if (error) {
      throw new Error(`Error saving article: ${error.message}`);
    }
    
    return data;
  },
});

// 記事取得ツール
export const getArticleToolDef = createTool({
  id: 'getArticleToolDef',
  description: 'Get an article from the database by ID',
  inputSchema: z.object({
    id: z.number().describe('The ID of the article to fetch'),
  }),
  outputSchema: z.object({
    id: z.number(),
    title: z.string(),
    content: z.string(),
    category_id: z.number(),
    status: z.string(),
    keywords: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    published_at: z.string().nullable(),
    meta_title: z.string().nullable(),
    meta_desc: z.string().nullable(),
  }),
  execute: async ({ context }) => {
    const { id } = context;
    
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw new Error(`Error fetching article: ${error.message}`);
    }
    
    return data;
  },
});

// 記事更新ツール
export const updateArticleToolDef = createTool({
  id: 'updateArticleToolDef',
  description: 'Update an existing article in the database',
  inputSchema: z.object({
    id: z.number().describe('The ID of the article to update'),
    title: z.string().optional().describe('The title of the article'),
    content: z.string().optional().describe('The content of the article in markdown format'),
    category_id: z.number().optional().describe('The ID of the category'),
    status: z.enum(['draft', 'published']).optional().describe('The status of the article'),
    keywords: z.string().optional().describe('Keywords for the article'),
    meta_title: z.string().optional().describe('Meta title for SEO'),
    meta_desc: z.string().optional().describe('Meta description for SEO'),
  }),
  outputSchema: z.object({
    id: z.number(),
    title: z.string(),
    status: z.string(),
    updated_at: z.string(),
  }),
  execute: async ({ context }) => {
    const { 
      id, 
      title, 
      content, 
      category_id, 
      status, 
      keywords, 
      meta_title, 
      meta_desc 
    } = context;
    
    // 更新データの準備
    const updateData: any = {};
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (category_id) updateData.category_id = category_id;
    if (status) {
      updateData.status = status;
      // 公開ステータスに変更された場合、公開日時を設定
      if (status === 'published') {
        updateData.published_at = new Date().toISOString();
      }
    }
    if (keywords) updateData.keywords = keywords;
    if (meta_title) updateData.meta_title = meta_title;
    if (meta_desc) updateData.meta_desc = meta_desc;
    
    const { data, error } = await supabase
      .from('articles')
      .update(updateData)
      .eq('id', id)
      .select('id, title, status, updated_at')
      .single();
    
    if (error) {
      throw new Error(`Error updating article: ${error.message}`);
    }
    
    return data;
  },
});

// 記事一覧取得ツール
export const listArticlesToolDef = createTool({
  id: 'listArticlesToolDef',
  description: 'List articles from the database with optional filtering',
  inputSchema: z.object({
    category_id: z.number().optional().describe('Filter by category ID'),
    status: z.enum(['draft', 'published']).optional().describe('Filter by status'),
    limit: z.number().default(10).describe('Number of articles to return'),
    offset: z.number().default(0).describe('Offset for pagination'),
  }),
  outputSchema: z.array(z.object({
    id: z.number(),
    title: z.string(),
    category_id: z.number(),
    status: z.string(),
    created_at: z.string(),
    published_at: z.string().nullable(),
  })),
  execute: async ({ context }) => {
    const { category_id, status, limit, offset } = context;
    
    let query = supabase
      .from('articles')
      .select('id, title, category_id, status, created_at, published_at')
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);
    
    if (category_id) {
      query = query.eq('category_id', category_id);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Error listing articles: ${error.message}`);
    }
    
    return data || [];
  },
});

// データベースツールをまとめて公開
export const databaseTools = {
  getCategoriesToolDef,
  createCategoryToolDef,
  saveArticleToolDef,
  getArticleToolDef,
  updateArticleToolDef,
  listArticlesToolDef,
}; 