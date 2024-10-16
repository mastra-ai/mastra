/** @type {import('next').NextConfig} */
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '**'
      }
    ]
  },
  transpilePackages: [
    '@mastra/core',
    '@mastra/firecrawl',
    '@mastra/slack',
    '@mastra/github'
  ]
}
