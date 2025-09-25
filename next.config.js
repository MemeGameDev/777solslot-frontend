/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // allowedDevOrigins must be top-level for Next.js dev server cross-origin HMR
  allowedDevOrigins: [
    'https://screen-another-ntsc-templates.trycloudflare.com',
    'https://response-fortune-adrian-period.trycloudflare.com'
  ],
  experimental: {
    // Keep any other experimental flags here if you need them
  }
};

module.exports = nextConfig;
