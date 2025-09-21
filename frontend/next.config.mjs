/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', 'apib.theblackforestcakes.com'],
  },
  transpilePackages: [
    // Core Ant Design packages
    'antd',
    '@ant-design/icons',
    '@ant-design/icons-svg',
    // Unscoped rc-* packages
    'rc-util',
    'rc-picker',
    'rc-tree',
    'rc-table',
    'rc-input',
    'rc-pagination',
    'rc-select',
    'rc-textarea',
    'rc-dropdown',
    'rc-menu',
    'rc-notification',
    // Scoped @rc-component/* packages
    '@rc-component/util',
    '@rc-component/portal',
    '@rc-component/context',
    '@rc-component/tour',
  ],
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
};

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})(nextConfig);