
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 关键：使用相对路径基准，防止部署在非根目录下时出现 404/NoSuchKey
  base: './',
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // 确保 assets 文件夹中的文件名不带过深层次，方便云端管理
    assetsDir: 'assets',
  }
});
