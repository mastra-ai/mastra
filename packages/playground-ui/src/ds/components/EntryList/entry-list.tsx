import { EntryListEntries } from './entry-list-entries';
import { EntryListEntry } from './entry-list-entry';
import { EntryListEntryStatusCol, EntryListEntryTextCol } from './entry-list-entry-col';
import { EntryListHeader } from './entry-list-header';
import { EntryListMessage } from './entry-list-message';
import { EntryListNextPageLoading } from './entry-list-next-page-loading';
import { EntryListPagination } from './entry-list-pagination';
import { EntryListRoot } from './entry-list-root';
import { EntryListTrim } from './entry-list-trim';

export const EntryList = Object.assign(EntryListRoot, {
  Header: EntryListHeader,
  Trim: EntryListTrim,
  Entries: EntryListEntries,
  Entry: EntryListEntry,
  Message: EntryListMessage,
  NextPageLoading: EntryListNextPageLoading,
  Pagination: EntryListPagination,
  EntryText: EntryListEntryTextCol,
  EntryStatus: EntryListEntryStatusCol,
});
