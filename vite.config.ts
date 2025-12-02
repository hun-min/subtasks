import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.vercel\.app\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'vercel-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 5
              }
            }
          }
        ]
      },
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Protocol System',
        short_name: 'Protocol',
        description: 'Focus on your objective.',
        theme_color: '#030712',
        background_color: '#030712',
        display: 'standalone',
        version: '2.0.0',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
