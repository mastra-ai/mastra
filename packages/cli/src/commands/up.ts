import { execa } from 'execa';

export async function up() {
  return execa(`docker-compose --file mastra.docker-compose.yaml up --detach`, {
    shell: true,
    all: true,
    stdio: 'inherit', // inherit will pipe directly to parent process stdout/stderr
  });
}
