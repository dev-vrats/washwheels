/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // Allow Leaflet CSS import from node_modules
  transpilePackages: ['leaflet', 'react-leaflet'],
}

module.exports = nextConfig
