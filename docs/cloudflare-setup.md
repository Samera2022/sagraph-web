# Cloudflare 当前配置

资源和域名均已创建，本文件只记录项目配置，避免重复创建。

## Pages

```text
Project: sagraph-web
Domain: https://www.sagraph.top
Git root directory: sagraph-web
Build command: pnpm build
Build output directory: dist
Node.js: 22
```

Production 环境变量：

```text
PUBLIC_SITE_URL=https://www.sagraph.top
PUBLIC_API_BASE_URL=https://api.sagraph.top
PUBLIC_DOWNLOAD_BASE_URL=https://download.sagraph.top
```

## Worker

```text
Project: sagraph-api
Source directory: sagraph-api
API domain: https://api.sagraph.top
Download domain: https://download.sagraph.top
```

部署：

```bash
cd sagraph-api
pnpm install
pnpm check
pnpm deploy
```

## R2

```text
Bucket: sagraph-releases
Worker binding: RELEASES_BUCKET
```

公开下载必须经过 `download.sagraph.top` 对应的 Worker 路由，不要把整个 R2 bucket 设为公开。

## Secrets

Updater 私钥只放在发布 CI：

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

更新日志私钥优先放在发布 CI：

```text
CHANGELOG_SIGNING_PRIVATE_KEY
```

付费更新会话实现后再给 Worker 添加：

```text
UPDATE_TOKEN_SECRET
```

完整后续实施流程见 `docs/cloudflare-after-setup.md`。
