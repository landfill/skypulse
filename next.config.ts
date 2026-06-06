import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // satellite.js v7 WASM pthreads 런타임이 node: 스킴으로 모듈을 참조함.
      // webpack은 브라우저 번들에서 node: 스킴을 지원하지 않으므로:
      // 1) node: 접두사를 제거하여 일반 모듈명으로 변환
      // 2) resolve.fallback으로 빈 모듈 반환
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        })
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        module: false,
        worker_threads: false,
      };
    }
    return config;
  },
};

export default nextConfig;
