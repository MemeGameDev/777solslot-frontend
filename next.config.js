/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // allowedDevOrigins must be top-level (not inside experimental) for this Next version
  allowedDevOrigins: [
    'https://screen-another-ntsc-templates.trycloudflare.com',
    'https://response-fortune-adrian-period.trycloudflare.com'
  ],
  experimental: {
    // keep other experimental options here if you need them
  }
};

module.exports = nextConfig;
