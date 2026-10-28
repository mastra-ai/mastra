const lifted = 'transition-colors motion-reduce:transition-none';

export const rowStyle = {
  trigger: 'hover:bg-transparent',
  header: 'w-fit max-w-full px-0',
  content: 'ml-2',
  text: `${lifted} group-hover/row:text-foreground group-has-focus-visible/row:text-foreground`,
  icon: `${lifted} group-hover/row:text-muted-foreground group-has-focus-visible/row:text-muted-foreground`,
};

export const prominentStyle = {
  trigger: 'mb-2 border-b border-border pb-2',
  text: 'text-body',
  detail: 'text-body-sm',
};
