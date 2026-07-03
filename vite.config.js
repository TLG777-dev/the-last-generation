import { resolve } from 'path'
import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'

export default defineConfig({
  plugins: [glsl()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api/gdacs': {
        target: 'https://www.gdacs.org/gdacsapi/api/Events/geteventlist',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/gdacs/, '')
      },
      '/api/fireball': {
        target: 'https://ssd-api.jpl.nasa.gov',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/fireball/, '/fireball.api')
      },
      '/api/kvert': {
        target: 'http://kvert.febras.net/van',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/kvert/, '')
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        apophis: resolve(__dirname, 'apophis.html'),
        disasters: resolve(__dirname, 'disasters.html'),
        conflicts: resolve(__dirname, 'conflicts.html'),
        'sign-of-jonah': resolve(__dirname, 'sign-of-jonah.html'),
        calendar: resolve(__dirname, 'calendar.html'),
        'aleph-tav': resolve(__dirname, 'aleph-tav.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        'hebrew-feasts': resolve(__dirname, 'hebrew-feasts.html'),
        rapture: resolve(__dirname, 'rapture.html'),
        convergence: resolve(__dirname, 'convergence.html'),
        timeline: resolve(__dirname, 'timeline.html'),
        'revelation-walkthrough': resolve(__dirname, 'revelation-walkthrough.html'),
        library: resolve(__dirname, 'library.html'),
        glossary: resolve(__dirname, 'glossary.html'),
        'rev12-calculator': resolve(__dirname, 'rev12-calculator.html'),
        betrothal: resolve(__dirname, 'betrothal.html'),
        digest: resolve(__dirname, 'digest.html'),
      }
    }
  }
})
