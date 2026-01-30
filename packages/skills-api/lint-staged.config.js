export default {
  '*.ts': ['tsc-files --noEmit', 'eslint'],
  '*.{ts,md,json}': ['prettier --write'],
};
