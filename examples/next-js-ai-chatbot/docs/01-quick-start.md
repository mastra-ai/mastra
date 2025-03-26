# Quick Start

The chatbot template is a web application built using [Next.js](https://nextjs.org) and the [AI SDK](https://sdk.vercel.ai) that can be used as a starting point for building your own AI applications. The template is designed to be easily customizable and extendable, allowing you to add new features and integrations as needed.

Deploying to [Vercel](https://vercel.com) is the quickest way to get started with the chatbot template, as it automatically sets up the project by connecting to integrations and deploys it to the cloud. You can then later develop the project locally and push changes to the Vercel project.

### Pre-requisites:

- Vercel account and [Vercel CLI](https://vercel.com/docs/cli)
- GitHub/GitLab/Bitbucket account
- API Key from [OpenAI](https://platform.openai.com)

### Deploy to Vercel

To deploy the chatbot template to Vercel, click this [link](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fai-chatbot&env=AUTH_SECRET,OPENAI_API_KEY&envDescription=Learn%20more%20about%20how%20to%20get%20the%20API%20Keys%20for%20the%20application&envLink=https%3A%2F%2Fgithub.com%2Fvercel%2Fai-chatbot%2Fblob%2Fmain%2F.env.example&demo-title=AI%20Chatbot&demo-description=An%20Open-Source%20AI%20Chatbot%20Template%20Built%20With%20Next.js%20and%20the%20AI%20SDK%20by%20Vercel.&demo-url=https%3A%2F%2Fchat.vercel.ai&stores=%5B%7B%22type%22:%22postgres%22%7D,%7B%22type%22:%22blob%22%7D%5D) to enter the 1-click deploy flow.

During the flow, you will be prompted to create and connect to a postgres database and blob store. You will also need to provide environment variables for the application.

After deploying the project, you can access the chatbot template by visiting the URL provided by Vercel.

### Local Development

To develop the chatbot template locally, you can clone the repository and link it to your Vercel project. This will allow you to pull the environment variables from the Vercel project and use them locally.

```bash
git clone https://github.com/<username>/<repository>
cd <repository>
pnpm install

vercel link
vercel env pull
```

After linking the project, you can start the development server by running:

```bash
pnpm dev
```

The chatbot template will be available at `http://localhost:3000`.
