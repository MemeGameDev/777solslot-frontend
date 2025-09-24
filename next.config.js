/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Keep allowedDevOrigins top-level for your Cloudflare Tunnel hostnames
  // (this avoids the "invalid next.config" warning you saw earlier).
  allowedDevOrigins: [
    'https://screen-another-ntsc-templates.trycloudflare.com',
    'https://response-fortune-adrian-period.trycloudflare.com'
  ],

  // Static export for Cloudflare Pages (important)
  output: 'export',

  // You can keep other experimental flags here if needed
  experimental: {
    // e.g. appDir: true  (only if you're using app/ router)
  }
};

module.exports = nextConfig;
