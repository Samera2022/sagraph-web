# saGraph Web Services

本仓库分别管理 saGraph 官网和更新 API：

```text
sagraph-web/  Astro + Cloudflare Pages
sagraph-api/  Cloudflare Worker + R2

docs/         两个项目共用的部署与更新协议文档
```

## Pages

```bash
cd sagraph-web
pnpm install
pnpm check
pnpm build
```

Cloudflare Pages 配置：

```text
Root directory: sagraph-web
Build command: pnpm build
Build output directory: dist
Production domain: https://www.sagraph.top
```

## Worker

```bash
cd sagraph-api
pnpm install
pnpm dev
```

部署：

```bash
pnpm deploy
```

Worker 使用以下域名和 R2 binding：

```text
API domain: https://api.sagraph.top
Download domain: https://download.sagraph.top
R2 binding: RELEASES_BUCKET -> sagraph-releases
```

详细操作见 `docs/cloudflare-after-setup.md`。
