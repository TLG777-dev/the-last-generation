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
      },
      '/api/jpl-horizons': {
        target: 'https://ssd.jpl.nasa.gov',
        changeOrigin: true,
        rewrite: path => {
          const url = new URL(path, 'http://localhost')
          const params = url.searchParams
          const command = params.get('command') || '399'
          const start = params.get('start') || '2017-Sep-23'
          const stop = params.get('stop') || '2017-Sep-24'
          return `/api/horizons.api?format=json&COMMAND='${command}'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='OBSERVER'&CENTER='500@399'&START_TIME='${start}'&STOP_TIME='${stop}'&STEP_SIZE='1 d'`
        }
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
        'revelation-12-sign': resolve(__dirname, 'revelation-12-sign.html'),
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
        'bible-downloads': resolve(__dirname, 'bible-downloads.html'),
      }
    }
  }
})
