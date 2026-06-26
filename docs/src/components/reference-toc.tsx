import Link from '@docusaurus/Link'

import sidebar from '../content/reference/sidebars'

type SidebarDocItem = {
	type: 'doc'
	id: string
	label?: string
}

type SidebarCategoryItem = {
	type: 'category'
	label: string
	items: SidebarItem[]
}

type SidebarLinkItem = {
	type: 'link'
	label: string
	href: string
}

type SidebarItem = SidebarDocItem | SidebarCategoryItem | SidebarLinkItem | string

const getDocHref = (id: string) => {
	const normalizedId = id.replace(/(^|\/)index$/, '')

	return normalizedId ? `/reference/${normalizedId}` : '/reference'
}

const renderSidebarItem = (item: SidebarItem) => {
	if (typeof item === 'string') {
		return (
			<li key={item}>
				<Link to={getDocHref(item)}>{item}</Link>
			</li>
		)
	}

	if (item.type === 'doc') {
		return (
			<li key={item.id}>
				<Link to={getDocHref(item.id)}>{item.label ?? item.id}</Link>
			</li>
		)
	}

	if (item.type === 'link') {
		return (
			<li key={item.href}>
				<Link to={item.href}>{item.label}</Link>
			</li>
		)
	}

	return (
		<li key={item.label}>
			{item.label}
			<ul>{item.items.map(renderSidebarItem)}</ul>
		</li>
	)
}

export const ReferenceToc = () => {
	return <ul>{(sidebar.referenceSidebar as SidebarItem[]).map(renderSidebarItem)}</ul>
}
