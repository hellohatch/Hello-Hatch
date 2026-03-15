// ecosystem.sandbox.cjs — PM2 sandbox/dev config
// Uses npx tsx to run server.ts directly
module.exports = {
  apps: [
    {
      name: 'hatch-lri',
      script: 'node_modules/.bin/tsx',
      args: 'server.ts',
      cwd: '/home/user/webapp',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DB_PATH: '/home/user/webapp/data/lri.db',
      },
      error_file: '/home/user/.pm2/logs/hatch-lri-error.log',
      out_file:   '/home/user/.pm2/logs/hatch-lri-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 5,
    }
  ]
};
