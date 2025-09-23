# 🍌 Nano Banana - AI图像生成商业平台

一个完整的Nano Banana AI图像生成商业化平台，基于Vue3 + Node.js开发，支持快速部署和商业化运营。集成多种AI模型，提供文生图、图生图功能，内置会员系统、支付系统和完善的管理后台。

## ✨ 平台特色

- 🚀 **快速部署**：一键启动，自动初始化数据库和管理员账户
- 💰 **商业化就绪**：内置支付系统、会员套餐、订单管理
- 🎨 **多模型支持**：支持OpenAI、Claude等多种AI图像生成模型
- 📱 **响应式设计**：完美适配PC和移动端
- 🔐 **安全可靠**：JWT认证、数据加密、权限管理
- 📊 **数据统计**：完整的用户行为分析和收益统计

## 🎯 功能概览

| **用户端功能** | **管理端功能** | **待开发功能** |
|:---|:---|:---|
| 🎨 AI图像生成（文生图/图生图） | 🔧 系统配置管理 | 🎭 更多AI模型接入（GPT-4o\即梦4等） |
| 👤 用户注册登录系统 | 🔑 API令牌管理 | 🎨 图像编辑功能（裁剪、滤镜、调色） |
| 💳 会员套餐购买 | 👥 用户管理 | 🤖 批量生成功能 |
| 💰 在线支付（易支付集成） | 📦 套餐管理 | 📧 邮件通知系统 |
| 📚 生成历史记录管理 | 💸 订单和支付管理 | 🔔 站内消息系统 |
| 🖼️ 图片预览和下载 | 📊 数据统计分析 | 📈 高级数据分析 |
| 📱 响应式移动端适配 | 🎨 生成记录管理 | 🌐 国际化支持 |
| 🔐 JWT身份认证 | 🛡️ 权限控制系统 | 🎯 推荐算法 |
| 📁 文件上传管理 | 🔄 自动重试机制 | - |
| 📝 详细日志记录 | 🗄️ 数据库自动初始化 | - |

## 📸 功能预览

### 用户前台界面
#### 未登录
<img width="1097" height="750" alt="image" src="https://github.com/user-attachments/assets/cb65dabe-5423-4d18-9eeb-71b05e7580ff" />

#### 已登录
<img width="1350" height="939" alt="image" src="https://github.com/user-attachments/assets/26148e1f-2ab8-46db-91b6-743929996d32" />

#### 个人中心
<img width="1370" height="971" alt="image" src="https://github.com/user-attachments/assets/e1ad288c-404d-4eb6-b62a-260273b53b33" />

#### 套餐购买
<img width="1258" height="982" alt="image" src="https://github.com/user-attachments/assets/bc0f9e51-3c22-462f-9d5e-2d5c30197cb6" />

#### 历史记录
<img width="1235" height="1002" alt="image" src="https://github.com/user-attachments/assets/e5f0b54a-baba-42b8-b03d-4f90b4455a75" />

### 管理后台界面
<img width="1703" height="946" alt="image" src="https://github.com/user-attachments/assets/6a9a2121-51c0-4242-81af-f9ca6aa1c851" />

## 🚀 快速启动

### 1. 环境准备
确保已安装：
- Node.js 18+
- MySQL 8.0+

### 2. 数据库配置

创建数据库：
```sql
CREATE DATABASE nano_banana CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. 后端配置

```bash
# 进入后端目录
cd server

# 安装依赖
npm install

# 复制环境配置文件
cp env.example .env

# 编辑 .env 文件，配置数据库连接
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=your_password
# DB_NAME=nano_banana
# JWT_SECRET=your_super_secret_jwt_key_here
# PORT=8000
```

### 4. 启动后端服务

```bash
# 开发模式启动
npm run dev

# 或生产模式启动
npm run build
npm start
```

后端服务将运行在 `http://localhost:8000`

### 5. 前端配置

```bash
# 返回项目根目录
cd ..

# 安装依赖
npm install
```

### 6. 启动前端服务

**开发模式：**
```bash
npm run dev
```
前端将运行在 `http://localhost:3000`

**生产部署：**
```bash
# 构建生产版本
npm run build

# 使用静态服务器部署
npx serve dist -s -l 3000

# 或使用其他静态服务器（如nginx）指向 dist 目录
```

**后端生产部署：**
```bash
cd server

# 构建后端
npm run build

# 生产模式启动（使用构建后的文件）
npm start

# 或直接运行构建后的文件
node dist/index.js
```

## 📋 默认账户信息

系统启动后会自动创建管理员账户：

- **管理员账户**：`admin@nanobanana.com`
- **默认密码**：`admin123456`

## 🔧 系统配置

### API令牌配置
登录管理员账户后，在管理面板中配置AI服务的API令牌：
1. 访问 `/admin/tokens`
2. 添加支持的AI服务令牌（如OpenAI、Claude等）

### 易支付配置
在管理面板的系统配置中设置易支付参数：
1. 访问 `/admin/config`
2. 配置易支付商户ID、密钥等信息

### 套餐管理
在管理面板中创建和管理会员套餐：
1. 访问 `/admin/packages`
2. 设置不同的会员套餐和价格

## 🌐 访问地址

- **用户前台**：`http://localhost:3000`
- **管理后台**：`http://localhost:3000/admin`
- **API接口**：`http://localhost:8000/api`

## 🔄 数据库初始化

系统首次启动时会自动：
1. 创建所有必需的数据表
2. 初始化管理员账户
3. 设置默认系统配置

## ⚠️ 注意事项

1. **端口占用**：确保8000（后端）和3000（前端）端口未被占用
2. **文件权限**：确保`server/uploads/`目录有写入权限
3. **环境变量**：生产环境请修改JWT密钥等敏感配置
4. **API配置**：使用前请先在管理面板配置AI服务的API令牌

## 🛠️ 常用命令

```bash
# 前端
npm run dev          # 开发模式
npm run build        # 构建生产版本
npm run preview      # 预览构建结果

# 后端
cd server
npm run dev          # 开发模式
npm run build        # 构建
npm start            # 生产模式启动
```

## 💼 商业化部署
### 盈利模式

- 💳 **会员订阅**：按月/年收费的会员制度
- 🎫 **按次付费**：单次生成付费模式
- 📦 **套餐销售**：不同规格的生成次数包
- 🎨 **高级功能**：付费解锁高级AI模型
- 🏢 **企业定制**：为企业提供定制化服务

## 📞 技术支持

如遇问题，请检查：
1. 数据库连接是否正常
2. 端口是否被占用
3. 环境变量配置是否正确
4. API令牌是否已配置

## 📄 开源协议

本项目采用 MIT 协议开源，允许商业使用。

## 🤝 技术交流

- 📧 技术支持：vx ycyjgl3
- 🐛 问题反馈：[GitHub Issues]

---

*🍌 Nano Banana - 让AI图像生成更简单 | Powered by Vue3 + Node.js + MySQL*
