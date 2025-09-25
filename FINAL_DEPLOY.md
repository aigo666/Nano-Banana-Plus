# 🍌 Nano Banana 最终部署指南

## 📦 镜像信息
- **Docker Hub**: `aigo666/nano-banana:latest`
- **版本**: 最新稳定版 
- **特性**: 单容器部署，包含完整数据库字段，无需额外修复
- **架构**: All-in-one 容器（前端 + 后端 + Nginx）

## 🚀 快速部署

### 本地部署（连接本地MySQL）
```bash
docker run -d \
  --name nano-banana-app \
  -p 3000:3000 \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=3306 \
  -e DB_USER=root \
  -e DB_PASSWORD=你的密码 \
  -e DB_NAME=nano_banana \
  -e DB_SSL=false \
  -e BACKEND_PORT=8000 \
  --restart=unless-stopped \
  aigo666/nano-banana:latest
```

### 远程部署（连接远程MySQL）
```bash
docker run -d \
  --name nano-banana-app \
  -p 3000:3000 \
  -e DB_HOST=你的MySQL主机地址 \
  -e DB_PORT=3306 \
  -e DB_USER=root \
  -e DB_PASSWORD=你的密码 \
  -e DB_NAME=nano_banana \
  -e DB_SSL=false \
  -e BACKEND_PORT=8000 \
  -e NODE_ENV=production \
  --restart=unless-stopped \
  aigo666/nano-banana:latest
```

### 完整部署（包含MySQL）
```bash
# 创建网络
docker network create nano-network

# 启动MySQL
docker run -d \
  --name nano-mysql \
  --network nano-network \
  -e MYSQL_ROOT_PASSWORD=你的密码 \
  -e MYSQL_DATABASE=nano_banana \
  -p 3306:3306 \
  mysql:8.0

# 启动应用
docker run -d \
  --name nano-banana-app \
  --network nano-network \
  -p 3000:3000 \
  -e DB_HOST=nano-mysql \
  -e DB_PORT=3306 \
  -e DB_USER=root \
  -e DB_PASSWORD=你的密码 \
  -e DB_NAME=nano_banana \
  -e DB_SSL=false \
  -e BACKEND_PORT=8000 \
  --restart=unless-stopped \
  aigo666/nano-banana:latest
```

## ✅ 自动功能

1. **数据库自动初始化**：
   - 自动创建所有必需表
   - 包含所有必需字段（无需手动修复）
   - 自动创建管理员账户

2. **默认账户**：
   - 邮箱：`admin@nanobanana.com`
   - 密码：`admin123456`

3. **完整功能**：
   - ✅ 用户管理系统
   - ✅ 套餐管理（times, status字段）
   - ✅ 余额支付（默认关闭，可在后台开启）
   - ✅ 生成历史记录（consumed_times字段）
   - ✅ 会员系统（is_member, member_expires_at字段）

## 🔧 环境变量说明

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `DB_HOST` | ✅ | - | MySQL主机地址 |
| `DB_PORT` | ❌ | 3306 | MySQL端口 |
| `DB_USER` | ✅ | - | MySQL用户名 |
| `DB_PASSWORD` | ✅ | - | MySQL密码 |
| `DB_NAME` | ❌ | nano_banana | 数据库名称 |
| `DB_SSL` | ❌ | false | 是否启用SSL |
| `BACKEND_PORT` | ❌ | 8000 | 后端端口 |
| `NODE_ENV` | ❌ | production | 运行环境 |

## 🎯 访问应用

启动成功后访问：
- **前端**: http://localhost:3000
- **管理后台**: 使用管理员账户登录

## 📋 数据库表结构

此版本包含完整的数据库表结构：

### users 表
- 基础字段：id, username, email, password_hash, role, status
- 扩展字段：is_member, member_expires_at（会员相关）

### packages 表  
- 标准字段：id, name, times, price, status, validity_days

### generation_history 表
- 基础字段：id, user_id, prompt, status
- 扩展字段：consumed_times（消耗次数跟踪）

## 🔍 故障排除

1. **端口冲突**: 确保3000端口未被占用
2. **数据库连接**: 检查MySQL连接参数
3. **防火墙**: 确保端口3000可访问
4. **日志查看**: `docker logs nano-banana-app`

## 🎉 特性

- ✅ **单容器部署** - 一个镜像包含所有组件
- ✅ **完整前后端应用** - Vue3 + Node.js + Nginx
- ✅ **数据库自动初始化** - 自动创建表和管理员账户
- ✅ **无需手动修复字段** - 包含所有必需数据库字段
- ✅ **支持余额支付** - 可在后台开启/关闭
- ✅ **会员系统** - 完整的会员管理功能
- ✅ **后台管理完整** - 用户、套餐、支付、设置管理
- ✅ **移除版权信息** - 干净的用户界面
- ✅ **生产环境优化** - 性能和安全优化

## 📁 项目结构（精简版）

```
├── Dockerfile.all-in-one     # 唯一的Docker构建文件
├── docker/
│   ├── nginx/all-in-one.conf   # Nginx配置
│   ├── scripts/start.sh        # 容器启动脚本
│   └── supervisor/supervisord.conf  # 进程管理配置
├── FINAL_DEPLOY.md          # 部署指南（本文件）
├── src/                     # 前端源码
├── server/src/              # 后端源码
└── README.md               # 项目说明
```

---

**🎯 这是最终精简稳定版本，单容器All-in-one架构，可直接用于生产环境！**
