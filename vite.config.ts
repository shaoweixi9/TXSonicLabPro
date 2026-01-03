
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 关键：使用相对路径基准，防止部署在非根目录下时出现 404/NoSuchKey
  base: './',
  plugins: [react()],
  define: {
    // 允许在前端代码中使用 process.env.API_KEY
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    assetsDir: 'assets',
    // 确保构建时不会因为某些外部库而报错
    commonjsOptions: {
      transformMixedEsModules: true,
    }
  }
});
