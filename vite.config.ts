// vite.config.js - Build configuration.
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: './',                       // relative paths: works on GitHub Pages sub-paths too
  plugins: [
    react(),                        // JSX support and fast refresh
    basicSsl(),                     // dev only: HTTPS is required for the camera on phones
    VitePWA({
      registerType: 'autoUpdate',   // new versions are installed silently
      includeAssets: ['icon.svg'],
      // The web app manifest (name, icon, colors) is generated from this object.
      manifest: {
        name: 'Draughts P2P',
        short_name: 'Draughts',
        start_url: './',
        display: 'standalone',
        background_color: '#2b2118',
        theme_color: '#2b2118',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      // The service worker precaches every built file so the game works offline.
      workbox: { globPatterns: ['**/*.{js,css,html,svg}'] },
    }),
  ],
});
