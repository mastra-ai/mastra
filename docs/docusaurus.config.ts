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
		hsFormGuidLearn: process.env.HS_FORM_GUID_LEARN,
		gaId: process.env.GA_ID,
		posthogApiKey: process.env.POSTHOG_API_KEY,
		posthogHost: process.env.POSTHOG_HOST,
		routeVersions: {
			basePath: '/docs',
			paramSegment: 2,
			versions: [
				{ value: 'v1', label: 'Latest Version', isDefault: true },
				{ value: 'v0', label: 'v0' },
			],
			featureVersioning: {
				'/docs/get-started/build-with-ai': 'v1',
			},
		},
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
				siteDescription:
					'Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack. It includes everything you need to go from early prototypes to production-ready applications. Mastra integrates with frontend and backend frameworks like React, Next.js, and Node, or you can deploy it anywhere as a standalone server.',
				root: {
					prefixText: `# Mastra

> Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack. It includes everything you need to go from early prototypes to production-ready applications. Mastra integrates with frontend and backend frameworks like React, Next.js, and Node, or you can deploy it anywhere as a standalone server.

Below is an overview of all available documentation.`,
					instances: [
						{
							id: 'Kitchen Sink',
							routeBasePath: '/',
							sidebarPath: './src/content/kitchen-sink/sidebars.js',
							path: 'src/content/kitchen-sink',
							condensedCategories: ['Design Tokens', 'Typography'],
						},
						{
							id: 'Docs',
							routeBasePath: '/docs',
							sidebarPath: './src/content/docs/sidebars.js',
							path: 'src/content/docs',
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
						link: '/docs/get-started/overview',
					},
					{
						label: 'Try studio',
						description: 'Get up and running with Mastra Cloud',
						link: '/docs/getting-started/studio',
					},
				],
				algoliaAppId: process.env.ALGOLIA_APP_ID!,
				algoliaSearchApiKey: process.env.ALGOLIA_SEARCH_API_KEY!,
			} satisfies AlgoliaPluginOptions,
		],
		[
			'@docusaurus/plugin-content-docs',
			{
				id: 'kitchen-sink',
				beforeDefaultRehypePlugins: [shikiPlugin],
				path: 'src/content/kitchen-sink',
				routeBasePath: '/',
				sidebarPath: './src/content/kitchen-sink/sidebars.js',
				remarkPlugins: SHARED_REMARK_PLUGINS,
				admonitions: {
					keywords: ['note', 'tip', 'info', 'caution', 'danger', 'warning', 'alpha'],
				},
			},
		],
		[
			'@docusaurus/plugin-content-docs',
			{
				id: 'reference',
				beforeDefaultRehypePlugins: [shikiPlugin],
				path: 'src/content/reference',
				routeBasePath: '/reference',
				sidebarPath: './src/content/reference/sidebars.js',
				remarkPlugins: SHARED_REMARK_PLUGINS,
				editUrl: 'https://github.com/mastra-ai/docusaurus-mastra/tree/main/demo',
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
					editUrl: 'https://github.com/mastra-ai/docusaurus-mastra/tree/main/demo',
					// The placeholder.com editUrl is a special URL which we use to hide the "Edit this page" link in the UI
					// editUrl: 'http://placeholder.com',
					lastVersion: 'current',
					versions: {
						current: {
							label: 'v1',
						},
						'0.x': {
							label: 'v0.x',
							banner: 'unmaintained',
						},
					},
					remarkPlugins: SHARED_REMARK_PLUGINS,
				},
				theme: {
					customCss: './styles.css',
				},
			} satisfies Preset.Options,
		],
	],
	themeConfig: {
		image: 'img/docusaurus-social-card.jpg',
		// Site-wide social/meta tags that Docusaurus core does not emit on its own.
		// Core already emits og:title, og:description, og:image, og:url, og:locale,
		// twitter:card and twitter:image; these fill the gaps flagged as incomplete
		// Open Graph (og:type, og:site_name) and the missing Twitter title/desc.
		// Do NOT add og:url/og:title/og:description here — core sets those per page.
		metadata: [
			{ property: 'og:type', content: 'website' },
			{ property: 'og:site_name', content: 'Mastra Docusaurus Theme' },
			{ property: 'og:image:alt', content: 'Mastra Docusaurus Theme' },
			{ name: 'twitter:title', content: 'Mastra Docusaurus Theme' },
			{ name: 'twitter:description', content: 'The documentation theme for Mastra' },
		],
		colorMode: {
			respectPrefersColorScheme: true,
		},
		navbar: {
			title: 'Demo',
			logo: {
				alt: 'Mastra',
				src: 'img/mastra.svg',
				href: 'https://mastra.ai',
				width: 32,
			},
			items: [
				{
					type: 'docSidebar',
					sidebarId: 'kitchenSinkSidebar',
					position: 'left',
					label: 'Kitchen Sink',
					docsPluginId: 'kitchen-sink',
				},
				{
					type: 'docSidebar',
					sidebarId: 'docsSidebar',
					position: 'left',
					label: 'Docs',
				},
				{
					to: '/models',
					position: 'left',
					label: 'Models',
				},
				{
					to: '/guides',
					position: 'left',
					label: 'Guides & Migrations',
				},
				{
					type: 'docSidebar',
					sidebarId: 'referenceSidebar',
					position: 'left',
					label: 'Reference',
					docsPluginId: 'reference',
				},
				{
					type: 'custom-pillLink',
					position: 'left',
					label: 'Learn',
					to: '/learn',
					badge: 'new',
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

/*

	plugins: [
		[
			'@docusaurus/plugin-content-docs',
			{
				id: 'models',
				path: 'src/content/en/models',
				routeBasePath: 'models',
				sidebarPath: './src/content/en/models/sidebars.js',
				editUrl: 'https://github.com/mastra-ai/mastra/tree/main/docs',
				admonitions: ADMONITIONS_CONFIG,
				remarkPlugins: [...SHARED_REMARK_PLUGINS],
			},
		],
		[
			'@docusaurus/plugin-content-docs',
			{
				id: 'guides',
				path: 'src/content/en/guides',
				routeBasePath: 'guides',
				sidebarPath: './src/content/en/guides/sidebars.js',
				editUrl: 'https://github.com/mastra-ai/mastra/tree/main/docs',
				admonitions: ADMONITIONS_CONFIG,
				remarkPlugins: [...SHARED_REMARK_PLUGINS],
			},
		],
		[
			'@docusaurus/plugin-content-docs',
			{
				id: 'reference',
				path: 'src/content/en/reference',
				routeBasePath: 'reference',
				sidebarPath: './src/content/en/reference/sidebars.js',
				editUrl: 'https://github.com/mastra-ai/mastra/tree/main/docs',
				admonitions: ADMONITIONS_CONFIG,
				remarkPlugins: [...SHARED_REMARK_PLUGINS],
			},
		],
		[
			require.resolve('./src/plugins/docusaurus-plugin-llms-txt'),
			{
				siteUrl: 'https://mastra.ai',
				siteTitle: 'Mastra',
				siteDescription:
					'Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack. It includes everything you need to go from early prototypes to production-ready applications. Mastra integrates with frontend and backend frameworks like React, Next.js, and Node, or you can deploy it anywhere as a standalone server.',
				excludeRoutes: ['/404'],
			},
		],
	],
	presets: [
		[
			'classic',
			{
				docs: {
					path: 'src/content/en/docs',
					routeBasePath: 'docs',
					sidebarPath: './src/content/en/docs/sidebars.js',
					// Please change this to your repo.
					// Remove this to remove the "edit this page" links.
					editUrl: 'https://github.com/mastra-ai/mastra/tree/main/docs',
					admonitions: ADMONITIONS_CONFIG,
					remarkPlugins: [...SHARED_REMARK_PLUGINS],
				},
				blog: false,
				theme: {
					customCss: './custom.css',
				},
				sitemap: {
					lastmod: 'date',
					changefreq: 'weekly',
					priority: 0.5,
					ignorePatterns: ['/tags/**'],
					filename: 'sitemap.xml',
				},
			},
		],
	],
	themeConfig: {
		image: 'img/og-image.png',
		colorMode: {
			respectPrefersColorScheme: true,
		},
		prism: {
			// @ts-expect-error: FIXME
			theme: prismMastraLight,
			// @ts-expect-error: FIXME
			darkTheme: prismMastraDark,
			additionalLanguages: ['diff', 'bash'],
		},
	} satisfies ThemeConfig,
*/
