#!/bin/sh

# 全栈应用启动脚本

echo "🍌 Nano Banana - 启动全栈应用..."

# 设置环境变量默认值
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-8000}
export DB_HOST=${DB_HOST:-host.docker.internal}
export DB_PORT=${DB_PORT:-3306}
export DB_USER=${DB_USER:-root}
export DB_PASSWORD=${DB_PASSWORD:-nano123456}
export DB_NAME=${DB_NAME:-nano_banana}
export JWT_SECRET=${JWT_SECRET:-nano_banana_super_secret_jwt_key}
export JWT_EXPIRES_IN=${JWT_EXPIRES_IN:-7d}
export BASE_URL=${BASE_URL:-http://localhost:8000}
export UPLOAD_PATH=${UPLOAD_PATH:-./uploads}
export MAX_FILE_SIZE=${MAX_FILE_SIZE:-10485760}
export ADMIN_EMAIL=${ADMIN_EMAIL:-admin@nanobanana.com}
export ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123456}

# 创建必要的目录
mkdir -p /app/server/uploads /app/server/logs /var/log/supervisor /run/nginx

# 设置权限
chmod -R 755 /app/server/uploads /app/server/logs
chown -R nginx:nginx /usr/share/nginx/html

# 跳过数据库等待，让应用自己处理连接
echo "ℹ️  跳过数据库等待，应用将自动重试连接"

# 创建环境配置文件
cat > /app/server/.env << EOF
NODE_ENV=$NODE_ENV
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=$JWT_EXPIRES_IN
PORT=$PORT
BASE_URL=$BASE_URL
UPLOAD_PATH=$UPLOAD_PATH
MAX_FILE_SIZE=$MAX_FILE_SIZE
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF

echo "🚀 启动服务..."

# 启动 supervisor 管理进程
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
