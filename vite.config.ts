import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const allowedHosts = [
      'gratulatory-grievedly-florence.ngrok-free.dev',
      ...(env.VITE_ALLOWED_HOSTS ? env.VITE_ALLOWED_HOSTS.split(',').map(h => h.trim()).filter(Boolean) : [])
    ];
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts,
        proxy: {
          '/api': {
            target: env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:5000',
            changeOrigin: true,
            secure: false
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
