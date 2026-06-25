// Custom components
import { Accordion, AccordionItem } from '@mastra/docusaurus-theme/components/accordion'
import { BrandCard } from '@mastra/docusaurus-theme/components/brand-card'
import { Card } from '@mastra/docusaurus-theme/components/card'
import { CardGrid, CardGridItem } from '@mastra/docusaurus-theme/components/card-grid'
import { CopyPrompt } from '@mastra/docusaurus-theme/components/copy-prompt'
import { Feature, FeatureMatrix } from '@mastra/docusaurus-theme/components/feature-matrix'
import { Inject } from '@mastra/docusaurus-theme/components/inject'
import { OperatorsTable } from '@mastra/docusaurus-theme/components/operators-table'
import { Override } from '@mastra/docusaurus-theme/components/override'
import { PropertiesTable } from '@mastra/docusaurus-theme/components/properties-table'
import { ProviderModelsTable } from '@mastra/docusaurus-theme/components/provider-models-table'
import { SocialIconLink } from '@mastra/docusaurus-theme/components/social-icon-link'
import { SpotlightCard } from '@mastra/docusaurus-theme/components/spotlight-card'
import { StepItem, Steps } from '@mastra/docusaurus-theme/components/steps'
import { VideoPlayer } from '@mastra/docusaurus-theme/components/video'
import { YouTube } from '@mastra/docusaurus-theme/components/youtube'
// Import the original mapper
import MDXComponents from '@theme-original/MDXComponents'
import Tabs from '@theme-original/Tabs'
import TabItem from '@theme-original/TabItem'

export default {
	// Re-use the default mapping
	...MDXComponents,
	// Custom components
	Accordion,
	AccordionItem,
	BrandCard,
	Card,
	CardGrid,
	CardGridItem,
	CopyPrompt,
	FeatureMatrix,
	Feature,
	SocialIconLink,
	SpotlightCard,
	OperatorsTable,
	PropertiesTable,
	ProviderModelsTable,
	Inject,
	YouTube,
	Steps,
	StepItem,
	VideoPlayer,
	Override,
	Tabs,
	TabItem,
}
