import color from 'picocolors';

export const logger = {
  error(args: string) {
    console.log(color.red(args));
  },
  warn(args: string) {
    console.log(color.yellow(args));
  },
  info(args: string) {
    console.log(color.cyan(args));
  },
  success(args: string) {
    console.log(color.green(args));
  },
  break() {
    console.log('');
  },
};
