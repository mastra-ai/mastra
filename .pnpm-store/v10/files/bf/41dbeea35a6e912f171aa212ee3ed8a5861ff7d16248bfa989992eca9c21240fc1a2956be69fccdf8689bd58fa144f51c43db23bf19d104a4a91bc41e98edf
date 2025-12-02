import { type ErrorMetadataGroups, type ErrorMetadataRow } from './types.js';
/**
 * Attach metadata to the parsed error as groups, sections
 * and rows.
 *
 * - Groups are rendered as cards
 * - Sections are headings within the cards
 * - And rows are rendered within HTML tables.
 *
 * The primitive row values are rendered as it is and rich data-types
 * like Objects, Arrays, Maps are printed using dumper.
 */
export declare class Metadata {
    #private;
    /**
     * Define a group, its sections and their rows. In case of
     * existing groups/sections, the new data will be merged
     * with the existing data
     */
    group(name: string, sections: {
        [section: string]: ErrorMetadataRow | ErrorMetadataRow[];
    }): this;
    /**
     * Returns the existing metadata groups, sections and
     * rows.
     */
    toJSON(): ErrorMetadataGroups;
}
