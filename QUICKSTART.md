# 🚀 快速启动指南

## 一键启动步骤

### 1. 安装依赖

**前端依赖安装：**
```bash
npm install
```

**后端依赖安装：**
```bash
cd server
npm install
cd ..
```

### 2. 配置数据库

**创建MySQL数据库：**
```sql
-- 登录MySQL后执行
CREATE DATABASE nano_banana CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**配置数据库连接：**
```bash
cd server
cp env.example .env
```

**编辑 `server/.env` 文件：**
```env
# 数据库配置 - 请修改为你的实际配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=nano_banana

# JWT密钥 - 生产环境请使用强密钥
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRES_IN=7d

# 服务器配置
PORT=3000
NODE_ENV=development

# 管理员默认账号 - 首次启动后请及时修改
ADMIN_EMAIL=admin@nanobanana.com
ADMIN_PASSWORD=admin123456
```

### 3. 初始化数据库

```bash
cd server
npm run db:migrate
```

如果看到以下输出表示成功：
```
✅ 数据库连接成功
✅ 数据库表初始化成功
✅ 默认管理员账户创建成功
管理员邮箱: admin@nanobanana.com
管理员密码: admin123456
```

### 4. 启动服务

**启动后端服务器（新终端窗口）：**
```bash
cd server
npm run dev
```

看到以下输出表示后端启动成功：
```
✅ 服务器运行在 http://localhost:3000
📚 API文档: http://localhost:3000/health
🔧 环境: development
```

**启动前端开发服务器（新终端窗口）：**
```bash
npm run dev
```

看到以下输出表示前端启动成功：
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 5. 访问系统

- 🏠 **前端首页**: http://localhost:3000
- 🔧 **后端API**: http://localhost:8000
- 👑 **管理后台**: http://localhost:3000/admin

### 6. 默认账户

**管理员账户：**
- 邮箱: `admin@nanobanana.com`
- 密码: `admin123456`

**⚠️ 重要提醒：生产环境请立即修改默认密码！**

## 🎯 功能测试流程

### 普通用户流程
1. 访问 http://localhost:3000
2. 点击右上角"注册"按钮，在弹框中创建新账户
3. 注册成功后自动登录，或点击"登录"按钮登录
4. 点击用户头像旁的"个人中心"查看账户信息
5. 配置API密钥（图片生成需要）
6. 上传图片并选择风格
7. 生成AI图片

### 管理员流程
1. 点击"登录"按钮，在弹框中使用默认管理员账户登录
2. 登录后点击"管理后台"进入管理界面
3. 查看系统统计信息
4. 进入"用户管理"查看所有用户
5. 测试用户状态切换、角色变更等功能

## 🔧 常见问题

### 数据库连接失败
- 检查MySQL服务是否启动
- 确认`.env`文件中的数据库配置正确
- 确保数据库用户有创建数据库的权限

### 前端无法访问后端
- 确认后端服务器在3000端口正常启动
- 检查CORS配置（已预配置开发环境）
- 查看浏览器控制台错误信息

### 管理员账户登录失败
- 确认数据库迁移成功执行
- 检查`.env`文件中的管理员配置
- 查看后端控制台是否有创建管理员的成功日志

### JWT认证错误
- 检查`.env`文件中的JWT_SECRET配置
- 清除浏览器localStorage重新登录
- 确认token未过期

## 📚 开发提示

### 数据库重置
如需重置数据库：
```bash
# 删除所有表数据
mysql -u root -p -e "DROP DATABASE nano_banana; CREATE DATABASE nano_banana CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 重新迁移
cd server
npm run db:migrate
```

### 查看API文档
访问 http://localhost:3000/health 查看服务器状态

### 修改端口
- 前端端口：修改 `vite.config.ts`
- 后端端口：修改 `server/.env` 中的 `PORT`

## 🎉 恭喜！

如果一切正常，你现在应该有一个完整运行的AI图片生成系统，包含：
- ✅ 用户注册登录
- ✅ AI图片生成功能
- ✅ 用户权限管理
- ✅ 管理员后台
- ✅ 完整的前后端分离架构

开始享受你的AI图片生成之旅吧！🚀
