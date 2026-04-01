/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
      asyncWebAssembly: true,
    };

    // Tell webpack these Node built-ins are not available in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };

    // Fix circular dependency in Zama SDK workerHelpers by keeping related chunks together
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        // Avoid runtime chunk to prevent circular dependency between chunks
        runtimeChunk: false,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Keep Zama SDK together to avoid circular deps in workerHelpers
            zamaSdk: {
              test: /[\\/]node_modules[\\/]@zama-fhe[\\/]/,
              name: 'zama-sdk',
              priority: 10,
              reuseExistingChunk: true,
            },
            // Keep ethers together as it's used by Zama
            ethers: {
              test: /[\\/]node_modules[\\/]ethers[\\/]/,
              name: 'ethers',
              priority: 9,
              reuseExistingChunk: true,
            },
            // Default vendors
            defaultVendors: {
              test: /[\\/]node_modules[\\/](?!@zama-fhe|ethers)/,
              priority: -10,
              reuseExistingChunk: true,
            },
            // Default for app code
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
