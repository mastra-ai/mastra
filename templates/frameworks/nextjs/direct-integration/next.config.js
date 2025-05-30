/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Mastra packages to be bundled externally
  serverExternalPackages: ["@mastra/*"],
  
  // React strict mode for better development experience
  reactStrictMode: true,
  
  // Allow image optimization from trusted domains
  images: {
    domains: ['localhost'],
  },
};

export default nextConfig;
