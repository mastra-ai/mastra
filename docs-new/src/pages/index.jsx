import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

export default function Home() {
  return (
    <Layout title={`Mastra Documentation`} description="Description will go into a meta tag in <head />">
      <main>
        <div className="px-4 py-12 text-center">
          <h1>Welcome to Mastra Documentation</h1>
          <p>TypeScript agent framework for building AI applications</p>
          <div className="mt-4">
            <Link className="button button--primary button--lg" href="/docs">
              Get Started
            </Link>
          </div>
        </div>
      </main>
    </Layout>
  );
}
