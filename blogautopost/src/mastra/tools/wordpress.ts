import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import WPAPI from 'wpapi';
import TurndownService from 'turndown';
import showdown from 'showdown';

// マークダウンとHTMLの変換
const turndownService = new TurndownService(); // HTML -> Markdown
const markdownConverter = new showdown.Converter(); // Markdown -> HTML

// WordPress APIクライアントの設定
// @ts-ignore - WPAPIの型定義の問題を回避
const wp = new WPAPI({
  endpoint: 'https://pre-e-s-court.com/wp-json',
  username: 'yujiro',
  password: 'Bluecheese09',
  auth: true
});

// 認証ヘッダーの直接設定（Application Passwordsを使用するためのフォールバック）
// Application Passwordsを管理画面で作成した場合、そのパスワードを以下のように設定します
wp.setHeaders('Authorization', 'Basic ' + Buffer.from('yujiro:uKzz dlJA 6HhZ bIZG 3ic4 mtPb').toString('base64'));

// WordPress カテゴリー一覧取得ツール
export const getWpCategoriesToolDef = createTool({
  id: 'getWpCategoriesToolDef',
  description: 'Get all categories from WordPress',
  inputSchema: z.object({}),
  outputSchema: z.array(z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
    description: z.string().optional(),
  })),
  execute: async () => {
    try {
      const categories = await wp.categories().get();
      return categories.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description || '',
      }));
    } catch (error: any) {
      throw new Error(`Error fetching WordPress categories: ${error.message}`);
    }
  },
});

// WordPress カテゴリー作成ツール
export const createWpCategoryToolDef = createTool({
  id: 'createWpCategoryToolDef',
  description: 'Create a new category in WordPress',
  inputSchema: z.object({
    name: z.string().describe('The name of the category'),
    slug: z.string().optional().describe('The slug of the category (optional)'),
    description: z.string().optional().describe('The description of the category'),
  }),
  outputSchema: z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
    description: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { name, slug, description } = context;
    
    try {
      const category = await wp.categories().create({
        name,
        slug,
        description,
      });
      
      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description || '',
      };
    } catch (error: any) {
      throw new Error(`Error creating WordPress category: ${error.message}`);
    }
  },
});

// WordPress 記事投稿ツール
export const createWpPostToolDef = createTool({
  id: 'createWpPostToolDef',
  description: 'Create a new post in WordPress',
  inputSchema: z.object({
    title: z.string().describe('The title of the post'),
    content: z.string().describe('The content of the post (Markdown or HTML)'),
    category_ids: z.array(z.number()).describe('Array of category IDs'),
    status: z.enum(['draft', 'publish', 'pending', 'future']).default('draft').describe('Post status'),
    excerpt: z.string().optional().describe('Post excerpt'),
    featured_media: z.number().optional().describe('Featured image ID'),
    meta: z.object({
      meta_title: z.string().optional().describe('SEO meta title'),
      meta_description: z.string().optional().describe('SEO meta description'),
      meta_keywords: z.string().optional().describe('SEO meta keywords'),
    }).optional().describe('Post meta data for SEO'),
    is_markdown: z.boolean().default(true).describe('Whether content is in Markdown format'),
  }),
  outputSchema: z.object({
    id: z.number(),
    title: z.object({
      rendered: z.string(),
    }),
    link: z.string(),
    status: z.string(),
  }),
  execute: async ({ context }) => {
    const { 
      title, 
      content, 
      category_ids, 
      status, 
      excerpt, 
      featured_media,
      meta,
      is_markdown 
    } = context;
    
    try {
      // マークダウンからHTMLへの変換（必要な場合）
      let processedContent = content;
      if (is_markdown) {
        processedContent = markdownConverter.makeHtml(content);
      }
      
      // 投稿データの作成
      const postData: any = {
        title,
        content: processedContent,
        status,
        categories: category_ids,
      };
      
      // オプションフィールドの追加
      if (excerpt) postData.excerpt = excerpt;
      if (featured_media) postData.featured_media = featured_media;
      
      // メタデータの追加（Yoast SEO プラグインなどが必要）
      if (meta) {
        postData.meta = {};
        if (meta.meta_title) postData.meta._yoast_wpseo_title = meta.meta_title;
        if (meta.meta_description) postData.meta._yoast_wpseo_metadesc = meta.meta_description;
        if (meta.meta_keywords) postData.meta._yoast_wpseo_focuskw = meta.meta_keywords;
      }
      
      // 投稿を作成
      const post = await wp.posts().create(postData);
      
      return {
        id: post.id,
        title: { rendered: post.title.rendered },
        link: post.link,
        status: post.status,
      };
    } catch (error: any) {
      throw new Error(`Error creating WordPress post: ${error.message}`);
    }
  },
});

// WordPress 記事更新ツール
export const updateWpPostToolDef = createTool({
  id: 'updateWpPostToolDef',
  description: 'Update an existing post in WordPress',
  inputSchema: z.object({
    id: z.number().describe('The ID of the post to update'),
    title: z.string().optional().describe('The title of the post'),
    content: z.string().optional().describe('The content of the post (Markdown or HTML)'),
    category_ids: z.array(z.number()).optional().describe('Array of category IDs'),
    status: z.enum(['draft', 'publish', 'pending', 'future']).optional().describe('Post status'),
    excerpt: z.string().optional().describe('Post excerpt'),
    featured_media: z.number().optional().describe('Featured image ID'),
    meta: z.object({
      meta_title: z.string().optional().describe('SEO meta title'),
      meta_description: z.string().optional().describe('SEO meta description'),
      meta_keywords: z.string().optional().describe('SEO meta keywords'),
    }).optional().describe('Post meta data for SEO'),
    is_markdown: z.boolean().default(true).describe('Whether content is in Markdown format'),
  }),
  outputSchema: z.object({
    id: z.number(),
    title: z.object({
      rendered: z.string(),
    }),
    link: z.string(),
    status: z.string(),
  }),
  execute: async ({ context }) => {
    const { 
      id,
      title, 
      content, 
      category_ids, 
      status, 
      excerpt, 
      featured_media,
      meta,
      is_markdown 
    } = context;
    
    try {
      // 更新データの準備
      const updateData: any = {};
      
      if (title) updateData.title = title;
      
      if (content) {
        // マークダウンからHTMLへの変換（必要な場合）
        updateData.content = is_markdown ? markdownConverter.makeHtml(content) : content;
      }
      
      if (category_ids) updateData.categories = category_ids;
      if (status) updateData.status = status;
      if (excerpt) updateData.excerpt = excerpt;
      if (featured_media) updateData.featured_media = featured_media;
      
      // メタデータの更新（Yoast SEO プラグインなどが必要）
      if (meta) {
        updateData.meta = {};
        if (meta.meta_title) updateData.meta._yoast_wpseo_title = meta.meta_title;
        if (meta.meta_description) updateData.meta._yoast_wpseo_metadesc = meta.meta_description;
        if (meta.meta_keywords) updateData.meta._yoast_wpseo_focuskw = meta.meta_keywords;
      }
      
      // 投稿を更新
      const post = await wp.posts().id(id).update(updateData);
      
      return {
        id: post.id,
        title: { rendered: post.title.rendered },
        link: post.link,
        status: post.status,
      };
    } catch (error: any) {
      throw new Error(`Error updating WordPress post: ${error.message}`);
    }
  },
});

// WordPress 記事取得ツール
export const getWpPostToolDef = createTool({
  id: 'getWpPostToolDef',
  description: 'Get a post from WordPress by ID',
  inputSchema: z.object({
    id: z.number().describe('The ID of the post to fetch'),
  }),
  outputSchema: z.object({
    id: z.number(),
    title: z.object({
      rendered: z.string(),
    }),
    content: z.object({
      rendered: z.string(),
    }),
    excerpt: z.object({
      rendered: z.string(),
    }),
    status: z.string(),
    link: z.string(),
    date: z.string(),
    modified: z.string(),
  }),
  execute: async ({ context }) => {
    const { id } = context;
    
    try {
      const post = await wp.posts().id(id).get();
      return post;
    } catch (error: any) {
      throw new Error(`Error fetching WordPress post: ${error.message}`);
    }
  },
});

// WordPress 記事一覧取得ツール
export const listWpPostsToolDef = createTool({
  id: 'listWpPostsToolDef',
  description: 'List posts from WordPress with optional filtering',
  inputSchema: z.object({
    category: z.number().optional().describe('Filter by category ID'),
    status: z.string().optional().describe('Filter by status'),
    per_page: z.number().default(10).describe('Number of posts per page'),
    page: z.number().default(1).describe('Page number'),
    search: z.string().optional().describe('Search term'),
  }),
  outputSchema: z.array(z.object({
    id: z.number(),
    title: z.object({
      rendered: z.string(),
    }),
    status: z.string(),
    link: z.string(),
    date: z.string(),
  })),
  execute: async ({ context }) => {
    const { category, status, per_page, page, search } = context;
    
    try {
      let query = wp.posts().perPage(per_page).page(page);
      
      if (category) query = query.category(category);
      if (status) query = query.status(status);
      if (search) query = query.search(search);
      
      const posts = await query.get();
      
      return posts.map((post: any) => ({
        id: post.id,
        title: { rendered: post.title.rendered },
        status: post.status,
        link: post.link,
        date: post.date,
      }));
    } catch (error: any) {
      throw new Error(`Error listing WordPress posts: ${error.message}`);
    }
  },
});

// WordPressツールをまとめて公開
export const wordpressTools = {
  getWpCategoriesToolDef,
  createWpCategoryToolDef,
  createWpPostToolDef,
  updateWpPostToolDef,
  getWpPostToolDef,
  listWpPostsToolDef,
}; 