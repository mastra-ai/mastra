# Future

This is a guide to developing the core package.

### Ensure Docker is Installed

If you haven't already, install Docker: (Docker Installation)[https://www.docker.com/]

### Start Docker Containers

1. Navigate to the .dev directory:`cd .dev`
2. Start the Docker containers:
   `docker-compose up -d`

This command will spin up the necessary services, including the database and the Inngest server.

### Setup Environment Variables

1. Copy the sample environment variable files:
   packages/admin/.env.local.sample
   packages/core/.env.local.sample
2. Duplicate and rename each .env.local.sample file to .env:
   cp packages/admin/.env.local.sample packages/admin/.env`
cp packages/core/.env.local.sample packages/core/.env`

Note: We won’t need to do this again after the first setup if the CLI persists credentials.

### Install Dependencies for Core Package

1. Navigate to the core directory:`cd packages/core`
2. Install the dependencies:`pnpm install`

### Build and Initialize CLI

1. Navigate to the cli directory:`cd packages/cli`
2. Build the project and run the initialization script:`pnpm run build && node dist/index.js init`
3. When prompted, supply the necessary credentials:

Database URL: postgresql://postgres:postgres@localhost:5432/postgres
Inngest Server URL: http://localhost:8288
