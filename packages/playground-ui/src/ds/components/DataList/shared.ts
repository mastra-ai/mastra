export const dataListRowStyles = [
  'mx-1 data-list-row grid grid-cols-subgrid gap-10 col-span-full px-5 outline-none cursor-pointer border-y border-b-border1 border-t-transparent',
  'hover:bg-surface4 hover:border-transparent focus-visible:bg-surface4 focus-visible:border-transparent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent1',
  '[.data-list-row:hover+&]:border-t-transparent [.data-list-row:focus-visible+&]:border-t-transparent',
  '[.data-list-subheader+&]:border-t-transparent',
  '[&:has(+.data-list-subheader)]:border-b-transparent',
  '[&:not(:has(~.data-list-row))]:border-b-transparent',
  'transition-colors duration-200 rounded-lg',
] as const;
