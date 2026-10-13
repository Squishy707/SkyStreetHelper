# SkyBlock Gemstone Flipper Pro: 核心架构、启停操作、多端部署与打包指南

---

## 一、 当前本地部署项目的核心文件构成与分工

本项目采用 **前后端解耦、微内核计算引擎** 架构，各核心文件职责如下：

```
c:\AntigravityProjects\20261010 SkyblockTracker/
├── 📁 backend/                        # [核心后端逻辑包]
│   ├── app.py                         # 🌐 API 路由器、跨域中间件、静态前端资源托管
│   ├── flipper_engine.py              # ⚙️ 计算核心：48种配方收益、80:1单向倍率、四象限损益、STDEVP风险与NPC套利引擎
│   ├── bazaar_service.py              # 📡 数据拉取与缓存服务：Hypixel官方Bazaar 62项物品抓取、15秒智能缓存防频控、选举监测
│   └── profile_service.py             # 👤 玩家服务：Minecraft UUID 解析、HotM 技能树与 Quick Forge 等级解析
│
├── 📁 static/                         # [前端界面与交互]
│   ├── index.html                     # 🖥️ 单页前端应用 (SPA)：暗黑拟态风格仪表盘、多选筛选器、四推荐卡片
│   ├── app.js                         # ⚡ 前端交互引擎：状态管理、Chart.js 三模态图表绘制、FlipCal 模拟器
│   └── style.css                      # 🎨 视觉样式表：宝石专属发光主题色、CN 难度徽章体系
│
├── 🚀 启动与运维控制
│   ├── run_server.py                  # Python 统一启动入口 (Uvicorn 8000 端口托管)
│   ├── start.bat                      # 🪟 Windows 一键双击启动脚本 (自动开服 + 自动唤起浏览器)
│   ├── stop.bat                       # 🛑 Windows 一键安全停服脚本 (查找并关闭 8000 端口)
│   └── build_exe.py                   # 📦 PyInstaller 一键打包独立单文件/绿色免安装包脚本
│
├── 📊 数据源与原型参考
│   ├── gemflipper.xlsx                # 原始 Excel 计算原型与离线冷备数据快照
│   └── ShardCalculator20260817.xlsx   # 历史参考表
│
└── 📖 沉淀文档
    ├── GEMSTONE_FLIPPING_GUIDE.md     # 宝石倒卖全流程实战指南与收货心法
    ├── README.md                      # 项目说明与接口文档
    └── WORKFLOW.md                    # 生产环境运维规范
```

---

## 二、 启动与关闭核心的操作指南

### 2.1 极简方式（推荐日常使用）
- **一键启动**：在文件夹中直接双击 **`start.bat`**。
  - 脚本会自动在后台启动 Python 服务，并等待 2 秒后自动唤起您的默认浏览器打开 `http://localhost:8000`。
- **一键关闭**：双击 **`stop.bat`**。
  - 脚本会自动扫描占用 `8000` 端口的进程 PID 并执行平滑终止。

### 2.2 命令行手动操作方式
- **前台启动**：
  ```powershell
  python run_server.py
  ```
  控制台会持续打印每个 HTTP 请求日志，按下 `Ctrl + C` 即可随时停止。
- **命令行后台常驻启动 (Windows PowerShell)**：
  ```powershell
  Start-Process -NoNewWindow python run_server.py
  ```
- **查看与杀掉进程**：
  ```powershell
  # 查找占用 8000 端口的进程 PID
  netstat -ano | findstr :8000
  # 杀死该 PID (假设 PID 为 1234)
  taskkill /F /PID 1234
  ```

---

## 三、 部署到开放平台或个人网站（上线公网）

如果您希望搭建一个让朋友或全服玩家无需配置环境即可直接访问的公开网站，需要完成以下环节：

### 3.1 基础设施准备
1. **云服务器 (一台轻量应用服务器即可)**：
   - 阿里云/腾讯云/华为云/AWS/DigitalOcean，推荐系统：`Ubuntu 22.04 LTS` 或 `Debian 12`；
   - 最低配置只需 **1核 CPU、1GB 内存** 即可轻松支撑上万次日访问量（因为我们有 15 秒内存缓存机制）。
2. **域名与解析**：
   - 购买一个域名（例如 `skyblockflip.com`），添加 A 记录解析至您的云服务器公网 IP。
   - *(注：国内云服务器需完成工信部 ICP 备案；若使用海外服务器如腾讯云香港、AWS 新加坡等，则解析后可直接访问)*。

### 3.2 服务器端部署步骤 (Linux / Docker)
推荐使用 Systemd 或 Docker 守护进程托管后端：

#### 方法 A：Systemd 常驻守护服务
1. 上传项目代码至服务器 `/opt/skyblock-flipper/`；
2. 安装依赖：`pip3 install fastapi uvicorn requests openpyxl numpy`；
3. 创建系统服务文件 `/etc/systemd/system/flipper.service`：
   ```ini
   [Unit]
   Description=Skyblock Gemstone Flipper Pro
   After=network.target

   [Service]
   User=root
   WorkingDirectory=/opt/skyblock-flipper
   ExecStart=/usr/bin/python3 -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --workers 2
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```
4. 启动并开机自启：
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now flipper
   ```

### 3.3 反向代理与 SSL (HTTPS) 配置
使用 **Nginx** 配合免费证书自动签发工具 Certbot：
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```
Nginx 站点配置 (`/etc/nginx/sites-available/flipper.conf`)：
```nginx
server {
    listen 80;
    server_name flipper.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
自动签发免费 HTTPS 证书：
```bash
sudo certbot --nginx -d flipper.yourdomain.com
```

### 3.4 针对 Hypixel API 的网络与防封优化
- **公网服务器网络优势**：海外或香港云服务器直连 `api.hypixel.net` 的延迟通常在 **10ms~50ms**，大幅快于国内家庭宽带，行情秒级更新极为流畅；
- **防止 Cloudflare 限频**：已在 `BazaarService` 中内置 **15秒全局共享内存缓存**，即使有 1000 位用户同时刷新网页，服务器每 15 秒对官方 API 也只产生 1 次请求，永远不会触发封禁。

---

## 四、 打包成 Portable 便携版或单 `.exe` 文件

如果您希望发给朋友，朋友电脑上**没有安装 Python 环境**，希望单文件双击即可使用：

### 4.1 方案原理：PyInstaller 静态封装
PyInstaller 会将精简版 Python 解释器、FastAPI/Uvicorn 依赖库、HTML/CSS/JS 前端资源以及 Excel 数据文件全部压缩打包成一个独立的单文件 `.exe` 可执行程序。运行启动时，自解压引导器会在临时内存/目录中加载静态资源（通过 `sys._MEIPASS` 兼容机制），实现零依赖极速启动。

### 4.2 一键打包操作
项目根目录下已为您内置了 [**`build_exe.py`**](file:///c:/AntigravityProjects/20261010%20SkyblockTracker/build_exe.py)：
1. 确保安装了打包工具：
   ```powershell
   pip install pyinstaller
   ```
2. 运行打包脚本：
   ```powershell
   python build_exe.py
   ```
3. 执行完成后，会在根目录下直接生成单个可执行文件：`dist/GemFlipper.exe`（体积约 38 MB）。
4. **交付形式**：
   - 直接将 `dist/GemFlipper.exe` 发送给朋友；
   - 朋友电脑双击运行，就会自动在本地启动服务并在默认浏览器中自动弹出 `GemFlipper (alpha 0.1.1)` 界面，**无需任何 Python 或第三方依赖**！
   - > ⚠️ **版本注意**：当前 `alpha 0.1.1` 版本中，IGN 玩家信息查询功能暂不可用，其他核心 Bazaar 实时行情和利润锻造计算功能均可完全脱机/联网正常使用。

---

## 五、 集成至微信小程序（实现手机端随身查）

微信小程序有严格的技术沙箱限制（**手机客户端内不能运行 Python/Uvicorn 后端**），必须采取**客户端 - 云服务端**分离架构。

通常有两种落地路径：

### 路径 A：`<web-view>` 容器一键内嵌（最快半小时上线）
- **前提要求**：
  1. 必须拥有一个经过工信部 ICP 备案的域名；
  2. 域名已配置全站 HTTPS；
  3. 将该域名添加到微信小程序后台的“业务域名”白名单中。
- **小程序端代码**：
  只需要一个最简页面 `pages/index/index.wxml`：
  ```xml
  <web-view src="https://flipper.yourdomain.com"></web-view>
  ```
- **优点**：UI 与逻辑 100% 复用我们做好的响应式网页，电脑端和手机端一套代码，任何功能改动服务器一更新，小程序立刻生效，零审核成本。

### 路径 B：小程序原生界面 + 调用我们的 REST API（体验最佳）
- 将我们的 FastAPI 后端作为标准的公网 API 服务（例如部署在 `https://api.yourdomain.com`）；
- 小程序前端使用原生 WXML + WXSS 设计卡片式手机界面；
- 小程序在 `onLoad` 或用户下拉刷新时发起请求：
  ```javascript
  wx.request({
    url: 'https://api.yourdomain.com/api/calculate',
    method: 'POST',
    data: {
      forges: this.data.forges,
      hotm_level: 7,
      quick_forge_level: 20,
      cole_active: false
    },
    success: (res) => {
      this.setData({
        flips: res.data.all_flips,
        recommendations: res.data.recommendations
      });
    }
  });
  ```
- **优点**：原生滑动更跟手，支持微信消息订阅推送（例如：“监测到 Peridot 出现跌破 NPC 价套利机会，点击查看”）。
