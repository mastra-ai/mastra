import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />">
      <main>
        <div style={{padding: '4rem 2rem', textAlign: 'center'}}>
          <h1>Welcome to Mastra Documentation</h1>
          <p>TypeScript agent framework for building AI applications</p>
          <div style={{marginTop: '2rem'}}>
            <Link
              className="button button--primary button--lg"
              to="/docs/intro">
              Get Started
            </Link>
          </div>
        </div>
      </main>
    </Layout>
  );
}
