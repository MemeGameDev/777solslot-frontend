/** next.config.js — force static export on Next 14+ */
 /** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export mode — next build will generate the `out/` folder
  output: 'export',

  // Keep other defaults. You can add future config here.
  // Example: trailingSlash: true,
};

module.exports = nextConfig;
