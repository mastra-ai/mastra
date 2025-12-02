declare function dateTo12HourTime(date: Date): string;
declare function differenceInCalendarDays(a: Date, b: Date, { absolute }?: {
    absolute?: boolean | undefined;
}): number;
declare function normalizeDate(d: Date | string | number): Date;
type DateFormatRelativeParams = {
    date: Date | string | number;
    relativeTo: Date | string | number;
};
type RelativeDateCase = 'previous6Days' | 'lastDay' | 'sameDay' | 'nextDay' | 'next6Days' | 'other';
type RelativeDateReturn = {
    relativeDateCase: RelativeDateCase;
    date: Date;
} | null;
declare function formatRelative(props: DateFormatRelativeParams): RelativeDateReturn;
declare function addYears(initialDate: Date | number | string, yearsToAdd: number): Date;

export { type RelativeDateCase, addYears, dateTo12HourTime, differenceInCalendarDays, formatRelative, normalizeDate };
