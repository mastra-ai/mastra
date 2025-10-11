import React from 'react';
import Layout from '@theme/Layout';
import { ShowcaseGrid } from '@site/src/components/ShowcaseGrid';

export default function Showcase() {
  return (
    <Layout
      title="Showcase"
      description="Check out these applications built with Mastra"
    >
      <ShowcaseGrid />
    </Layout>
  );
}
