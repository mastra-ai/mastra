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
  webpack: config => {
    config.resolve.fallback = {
      fs: false,
      path: false,
      os: false,
      tty: false,
      child_process: false
    }

    return config
  }
}
