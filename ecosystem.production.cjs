// ecosystem.config.cjs — PM2 production config for Digital Ocean Droplet
module.exports = {
  apps: [
    {
      name: 'hatch-lri',
      script: 'node',
      args: '--import tsx/esm server.ts',
      cwd: '/var/www/hatch-lri',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        DB_PATH: '/var/www/hatch-lri/data/lri.db',
      },
      error_file: '/var/log/hatch-lri/error.log',
      out_file:   '/var/log/hatch-lri/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 10,
    }
  ]
};
