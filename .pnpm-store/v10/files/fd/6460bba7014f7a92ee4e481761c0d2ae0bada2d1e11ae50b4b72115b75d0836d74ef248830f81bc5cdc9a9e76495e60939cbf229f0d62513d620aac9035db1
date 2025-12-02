import type { License } from "../public";

export interface ApiDatasetInfo {
	_id: string;
	id: string;
	arxivIds?: string[];
	author?: string;
	cardExists?: true;
	cardError?: unknown;
	cardData?: ApiDatasetMetadata;
	contributors?: Array<{ user: string; _id: string }>;
	disabled: boolean;
	discussionsDisabled: boolean;
	gated: false | "auto" | "manual";
	gitalyUid: string;
	lastAuthor: { email: string; user?: string };
	lastModified: string; // date
	likes: number;
	likesRecent: number;
	private: boolean;
	updatedAt: string; // date
	createdAt: string; // date
	tags: string[];
	paperswithcode_id?: string;
	sha: string;
	files?: string[];
	citation?: string;
	description?: string;
	downloads: number;
	downloadsAllTime: number;
	previewable?: boolean;
	doi?: { id: string; commit: string };
}

export interface ApiDatasetMetadata {
	licenses?: undefined;
	license?: License | License[];
	license_name?: string;
	license_link?: "LICENSE" | "LICENSE.md" | string;
	license_details?: string;
	languages?: undefined;
	language?: string | string[];
	language_bcp47?: string[];
	language_details?: string;
	tags?: string[];
	task_categories?: string[];
	task_ids?: string[];
	config_names?: string[];
	configs?: {
		config_name: string;
		data_files?:
			| string
			| string[]
			| {
					split: string;
					path: string | string[];
			  }[];
		data_dir?: string;
	}[];
	benchmark?: string;
	paperswithcode_id?: string | null;
	pretty_name?: string;
	viewer?: boolean;
	viewer_display_urls?: boolean;
	thumbnail?: string | null;
	description?: string | null;
	annotations_creators?: string[];
	language_creators?: string[];
	multilinguality?: string[];
	size_categories?: string[];
	source_datasets?: string[];
	extra_gated_prompt?: string;
	extra_gated_fields?: {
		/**
		 * "text" | "checkbox" | "date_picker" | "country" | "ip_location" | { type: "text" | "checkbox" | "date_picker" | "country" | "ip_location" } | { type: "select", options: Array<string | { label: string; value: string; }> } Property
		 */
		[x: string]:
			| "text"
			| "checkbox"
			| "date_picker"
			| "country"
			| "ip_location"
			| { type: "text" | "checkbox" | "date_picker" | "country" | "ip_location" }
			| { type: "select"; options: Array<string | { label: string; value: string }> };
	};
	extra_gated_heading?: string;
	extra_gated_description?: string;
	extra_gated_button_content?: string;
}
