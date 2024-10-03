/* eslint-disable react-hooks/rules-of-hooks */
import { useConfig } from 'nextra-theme-docs';

const docs = {
  logo: <span>Mastra</span>,
  project: {
    link: 'https://github.com/mastra-ai/mastra',
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – Mastra',
    };
  },
  head: () => {
    const { title } = useConfig();

    const ogTitle = `${title} – Mastra`;
    return (
      <>
        <title>{ogTitle}</title>
        <meta property="og:title" content={ogTitle} />
      </>
    );
  },
  // ... other theme options
};

export default docs;
