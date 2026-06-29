import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import type { AlgoliaPluginOptions } from '@mastra/docusaurus-plugin-algolia'
import type { LlmsTxtPluginOptions } from '@mastra/docusaurus-plugin-common/llms-txt'
import type { KapaPluginOptions } from '@mastra/docusaurus-plugin-kapa'
import type { DocusaurusThemeOptions } from '@mastra/docusaurus-theme'
import remarkNpm2yarn from '@docusaurus/remark-plugin-npm2yarn'
import remarkModelTokens from '@mastra/docusaurus-plugin-common/model-tokens'
import npm2yarnClass from '@mastra/docusaurus-plugin-common/npm2yarn-class'
import { shikiPlugin } from '@mastra/docusaurus-theme/shiki'
import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const NPM2YARN_CONFIG = { sync: true, converters: ['pnpm', 'yarn', 'bun'] }
const ENABLE_KAPA = Boolean(process.env.KAPA_INTEGRATION_ID)
const ENABLE_NEWSLETTER = Boolean(process.env.HS_PORTAL_ID && process.env.HS_FORM_GUID)
const SHARED_REMARK_PLUGINS = [[remarkNpm2yarn, NPM2YARN_CONFIG], npm2yarnClass, remarkModelTokens]

const config: Config = {
	title: 'Mastra Docs',
	tagline: 'The TypeScript Agent Framework',
	favicon: '/favicon.ico',
	future: {
		v4: true,
		faster: true,
	},
	storage: {
		type: 'localStorage',
		namespace: true,
	},
	url: 'https://mastra.ai',
	baseUrl: '/',
	// hint: do NOT set trailingSlash to any value to avoid rendering issues on vercel
	// see: https://github.com/slorber/trailing-slash-guide
	// trailingSlash: false,
	onBrokenLinks: 'throw',
	markdown: {
		hooks: {
			onBrokenMarkdownLinks: 'throw',
		},
	},
	themes: [
		[
			'@mastra/docusaurus-theme',
			{
				showCopyPage: true,
				feedback: {
					apiUrl: 'https://mastra.ai/api/feedback',
				},
				...(ENABLE_NEWSLETTER
					? {
							newsletter: {
								portalId: process.env.HS_PORTAL_ID!,
								formGuid: process.env.HS_FORM_GUID!,
							},
						}
					: {}),
			} satisfies DocusaurusThemeOptions,
		],
		ENABLE_KAPA && [
			'@mastra/docusaurus-plugin-kapa',
			{
				groupId: process.env.KAPA_GROUP_ID,
				integrationId: process.env.KAPA_INTEGRATION_ID,
			} satisfies KapaPluginOptions,
		],
	].filter(Boolean),
	customFields: {
		hsPortalId: process.env.HS_PORTAL_ID,
		gaId: process.env.GA_ID,
		posthogApiKey: process.env.POSTHOG_API_KEY,
		posthogHost: process.env.POSTHOG_HOST,
	},
	plugins: [
		[require.resolve('./src/plugins/docusaurus-plugin-learn'), {}],
		[
			'@docusaurus/plugin-vercel-analytics',
			{
				debug: false,
				mode: 'auto',
			},
		],
		'@mastra/docusaurus-plugin-common/tailwind',
		[
			'@mastra/docusaurus-plugin-common/llms-txt',
			{
				siteUrl: 'https://mastra.ai',
				siteTitle: 'Mastra',
				root: {
					prefixText: `# Mastra

> Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack. It includes everything you need to go from early prototypes to production-ready applications. Mastra integrates with frontend and backend frameworks like React, Next.js, and Node, or you can deploy it anywhere as a standalone server.

Below is an overview of all available documentation.`,
					instances: [
						{
							id: 'Docs',
							routeBasePath: '/docs',
							sidebarPath: './src/content/docs/sidebars.js',
							path: 'src/content/docs',
						},
						{
							id: 'Models',
							routeBasePath: '/models',
							sidebarPath: './src/content/models/sidebars.js',
							path: 'src/content/models',
							condensedCategories: ['Gateways', 'Providers'],
						},
						{
							id: 'Guides',
							routeBasePath: '/guides',
							sidebarPath: './src/content/guides/sidebars.js',
							path: 'src/content/guides',
						},
						{
							id: 'Reference',
							routeBasePath: '/reference',
							sidebarPath: './src/content/reference/sidebars.js',
							path: 'src/content/reference',
						},
					],
				},
			} satisfies LlmsTxtPluginOptions,
		],
		[
			'@mastra/docusaurus-plugin-algolia',
			{
				indexName: 'docs_main',
				hitsPerPage: 20,
				suggestedLinks: [
					{
						label: 'Quickstart',
						description: 'Get up and running with Mastra',
						link: '/guides/getting-started/quickstart',
					},
					{
						label: 'Try Studio',
						description: 'Interactive UI for building, testing, and managing agents',
						link: '/docs/studio/overview',
					},
				],
				algoliaAppId: process.env.ALGOLIA_APP_ID!,
				algoliaSearchApiKey: process.env.ALGOLIA_SEARCH_API_KEY!,
			} satisfies AlgoliaPluginOptions,
		],
		[
			'@docusaurus/plugin-content-docs',
			{
				id: 'models',
				beforeDefaultRehypePlugins: [shikiPlugin],
				path: 'src/content/models',
				routeBasePath: 'models',
				sidebarPath: './src/content/models/sidebars.js',
				remarkPlugins: SHARED_REMARK_PLUGINS,
				editUrl: 'https://github.com/mastra-ai/mastra/tree/main/docs',
			},
		],
		[
			'@docusaurus/plugin-content-docs',
			{
				id: 'guides',
				beforeDefaultRehypePlugins: [shikiPlugin],
				path: 'src/content/guides',
				routeBasePath: 'guides',
				sidebarPath: './src/content/guides/sidebars.js',
				remarkPlugins: SHARED_REMARK_PLUGINS,
				editUrl: 'https://github.com/mastra-ai/mastra/tree/main/docs',
			},
		],
		[
			'@docusaurus/plugin-content-docs',
			{
				id: 'reference',
				beforeDefaultRehypePlugins: [shikiPlugin],
				path: 'src/content/reference',
				routeBasePath: 'reference',
				sidebarPath: './src/content/reference/sidebars.js',
				remarkPlugins: SHARED_REMARK_PLUGINS,
				editUrl: 'https://github.com/mastra-ai/mastra/tree/main/docs',
			},
		],
	],
	presets: [
		[
			'classic',
			{
				docs: {
					beforeDefaultRehypePlugins: [shikiPlugin],
					path: 'src/content/docs',
					routeBasePath: '/docs',
					sidebarPath: './src/content/docs/sidebars.js',
					editUrl: 'https://github.com/mastra-ai/mastra/tree/main/docs',
					remarkPlugins: SHARED_REMARK_PLUGINS,
				},
				blog: false,
				theme: {
					customCss: './styles.css',
				},
			} satisfies Preset.Options,
		],
	],
	themeConfig: {
		image: 'og-image.png',
		metadata: [
			{ property: 'og:type', content: 'website' },
			{ property: 'og:site_name', content: 'Mastra' },
			{ property: 'og:image:alt', content: 'Mastra' },
			{ name: 'twitter:title', content: 'Mastra' },
			{ name: 'twitter:description', content: 'The TypeScript Agent Framework' },
		],
		colorMode: {
			respectPrefersColorScheme: true,
		},
		navbar: {
			logo: {
				alt: 'Mastra',
				src: 'mastra-wordmark.svg',
				href: 'https://mastra.ai',
			},
			items: [
				{
					type: 'docSidebar',
					sidebarId: 'docsSidebar',
					position: 'left',
					label: 'Docs',
				},
				{
					type: 'docSidebar',
					sidebarId: 'modelsSidebar',
					position: 'left',
					label: 'Models',
					docsPluginId: 'models',
				},
				{
					type: 'docSidebar',
					sidebarId: 'guidesSidebar',
					position: 'left',
					label: 'Guides',
					docsPluginId: 'guides',
				},
				{
					type: 'docSidebar',
					sidebarId: 'referenceSidebar',
					position: 'left',
					label: 'Reference',
					docsPluginId: 'reference',
				},
				{
					type: 'docSidebar',
					sidebarId: 'platformSidebar',
					position: 'left',
					label: 'Platform',
				},
				{
					type: 'search',
					position: 'right',
				},
				...(ENABLE_KAPA ? [{ type: 'custom-kapaChat', position: 'right' as const }] : []),
				{
					type: 'custom-socialIconLink',
					position: 'right',
					platform: 'github',
					href: 'https://github.com/mastra-ai/mastra',
				},
			],
		},
		// The Mastra Footer override renders its own hardcoded columns and ignores
		// these config contents; this minimal config only ensures the Footer mounts.
		footer: {
			style: 'dark',
			links: [],
		},
		prism: {},
	} satisfies Preset.ThemeConfig,
}

export default config
