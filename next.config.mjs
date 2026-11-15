const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Content-Security-Policy", value: "frame-ancestors https://*.manus.computer" },
        { key: "Permissions-Policy", value: "microphone=(self)" }
      ]
    }];
  }
};
export default nextConfig;
