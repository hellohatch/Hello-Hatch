#!/bin/bash
cd /home/user/webapp
export NODE_ENV=production
export PORT=3000
export DB_PATH=/home/user/webapp/data/lri.db
exec /home/user/webapp/node_modules/.bin/tsx server.ts
