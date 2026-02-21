import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const DATA_FILE = resolve(__dirname, 'data/cars.json')

function ensureDataFile() {
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, '[]', 'utf-8')
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'cars-api',
      configureServer(server) {
        ensureDataFile()
        server.middlewares.use('/api/cars', (req, res) => {
          res.setHeader('Content-Type', 'application/json')
          if (req.method === 'GET') {
            res.end(readFileSync(DATA_FILE, 'utf-8'))
          } else if (req.method === 'PUT') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              const pretty = JSON.stringify(JSON.parse(body), null, 2)
              writeFileSync(DATA_FILE, pretty, 'utf-8')
              res.end(pretty)
            })
          } else {
            res.statusCode = 405
            res.end('Method not allowed')
          }
        })
      },
    },
  ],
  server: {
    host: '127.0.0.1',
  },
})
