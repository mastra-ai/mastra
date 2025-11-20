This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Prerequisites

Before running the application, you need to set up your environment variables. Create a `.env.local` file in the root directory with the following variables:

```env
# Required API Keys
RAPID_API_KEY=your_rapid_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional - CSV file path for attractions data
# Defaults to src/data/city-data.csv if not specified
CSV_FILE_PATH=src/data/city-data.csv
```

#### Getting API Keys

- **RAPID_API_KEY**: Sign up at [RapidAPI](https://rapidapi.com/) and subscribe to the Booking.com API
- **OPENAI_API_KEY**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- **ANTHROPIC_API_KEY**: Get your API key from [Anthropic Console](https://console.anthropic.com/)

### Installation

Install dependencies using pnpm:

```bash
pnpm install
```

### Running the Development Server

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Database

The application uses LibSQL with a local file database (`file:mastra.db`). The database file will be automatically created when you first run the application. No additional setup or Docker containers are required!

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
