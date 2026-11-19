import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://139.190.107.150:5000/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://139.190.107.150:5000/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;