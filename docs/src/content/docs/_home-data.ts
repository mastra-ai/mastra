import type { FrameworkIconName } from '@mastra/docusaurus-theme/components/framework-icon'

export const frameworks: {
	title: string
	href: string
	icon: FrameworkIconName
}[] = [
	{ title: 'Next.js', href: '/guides/getting-started/next-js', icon: 'nextjs' },
	{ title: 'React', href: '/guides/getting-started/vite-react', icon: 'react' },
	{ title: 'Astro', href: '/guides/getting-started/astro', icon: 'astro' },
	{ title: 'Express', href: '/guides/getting-started/express', icon: 'express' },
	{ title: 'SvelteKit', href: '/guides/getting-started/sveltekit', icon: 'sveltekit' },
	{ title: 'Hono', href: '/guides/getting-started/hono', icon: 'hono' },
]

export const platform: {
	title: string
	description: string
	href: string
	icon: string
}[] = [
	{
		title: 'Observability',
		description: 'Metrics, Logs and Traces for Every Agent Run in Production',
		href: '/docs/mastra-platform/observability',
		icon: '/img/platform/observability.png',
	},
	{
		title: 'Studio',
		description: 'Invite your team and collaborate',
		href: '/docs/mastra-platform/studio',
		icon: '/img/platform/studio.png',
	},
	{
		title: 'Server',
		description: 'Deploy your Mastra agents and workflows',
		href: '/docs/mastra-platform/server',
		icon: '/img/platform/server.png',
	},
]

export const buildItems = [
	{
		title: 'Embed agents in your product',
		content: 'Ship assistants and copilots directly inside your app using framework-native APIs.',
	},
	{
		title: 'Automate workflows end to end',
		content: 'Orchestrate multi-step, branching processes with durable execution and retries.',
	},
	{
		title: 'Ground responses in your data',
		content: 'Connect vector stores and your own knowledge base for accurate, sourced answers.',
	},
	{
		title: 'Ship with confidence',
		content: 'Evaluate, trace, and monitor agent behavior before and after it reaches production.',
	},
]

export const community: {
	title: string
	href: string
	logo: string
}[] = [
	{ title: 'Discord', href: 'https://discord.gg/mastra', logo: '/img/community/discord.svg' },
	{ title: 'GitHub', href: 'https://github.com/mastra-ai/mastra', logo: '/img/community/github.svg' },
	{ title: 'YouTube', href: 'https://www.youtube.com/@mastra-ai', logo: '/img/community/youtube.svg' },
]
