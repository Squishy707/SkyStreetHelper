# SkyStreetHelper 工作流与服务器部署配置规范 (WORKFLOW.md)

> **Hypixel Skyblock Helper: Forge Gem-Flipping, Shard Price Tracking and Mutation Output Calculator**

本文件规范了将本应用从本地单机版过渡到长期生产环境（个人主页/云端服务器）的部署策略、自动化任务调度、容灾与插件拓展建议。

---

## 一、 生产环境部署方案

### 1.1 Docker 容器化打包
在项目根目录创建 `Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### 1.2 `requirements.txt` 配置
```text
fastapi>=0.115.0
uvicorn>=0.30.0
requests>=2.31.0
openpyxl>=3.1.2
numpy>=1.26.0
pydantic>=2.9.0
```

### 1.3 反向代理与 SSL (Nginx 推荐配置)
使用 Nginx 代理前端并配置 HTTPS 证书：
```nginx
server {
    listen 80;
    server_name flipper.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name flipper.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/flipper.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flipper.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 二、 自动化与防封控策略

1. **缓存机制 (Rate Limit 防控)**:
   - Hypixel 官方对于无 Key 的公共资源请求有频率限制。
   - `BazaarService` 内置了 15 秒内存缓存窗口，即使有成百上千位网页用户并发访问，后端在 15 秒内仅会向官方发起 1 次 HTTP 请求，极大降低被 Cloudflare 拦截的概率。
2. **离线灾备 (Snapshot Fallback)**:
   - 若 Hypixel API 短暂遭遇维护或网络波动，系统自动无缝切换到 `gemflipper.xlsx` 快照数据，保证前端计算不崩溃，并给出明确警告提示。
3. **定时心跳与报警**:
   - 可搭配自动化定时器（如 Crontab 或 Antigravity `/schedule` 工具）每隔 5 分钟向 `/api/arbitrage` 轮询一次。一旦检测到明显的低价套利机会，可通过 Webhook 向 Discord 或 Telegram 频道推送即时提醒。

---

## 三、 未来拓展路线图

1. **更多锻造配方扩展**:
   - 延伸支持 Drills (电钻)、Drill Engines、Divan Armor 等高利润金属矿物锻造倒卖；
2. **历史价格走势曲线**:
   - 集成 SQLite 或 PostgreSQL，记录每半小时的历史价格走势，辅助玩家预判周末/节日 Mining Fiesta 期间的宝石价格拐点；
3. **多语言与游戏内 Mod 联动**:
   - 暴露标准 JSON API，供 ChatTriggers 或 SkyHanni 等游戏内 Mod 一键拉取当前最优锻造方案。
