# GitHub 与 Cloudflare Pages 首次部署

本仓库现在包含两个独立项目：

```text
sagraph-web/  Astro 官网，部署到 Pages
sagraph-api/  Cloudflare Worker，部署到 Worker
```

Cloudflare Pages 只连接同一个仓库中的 `sagraph-web/` 子目录。

## Pages 项目配置

进入：

```text
Workers & Pages
→ sagraph-web
→ Settings
→ Builds & deployments
```

配置：

```text
Production branch: main
Framework preset: Astro
Root directory: sagraph-web
Build command: pnpm build
Build output directory: dist
Node.js version: 22
```

注意：Root directory 是 `sagraph-web`，output directory 仍然是 `dist`。不要把 output directory 填成 `sagraph-web/dist`。

Production 环境变量：

```text
NODE_VERSION=22
PUBLIC_SITE_URL=https://www.sagraph.top
PUBLIC_API_BASE_URL=https://api.sagraph.top
PUBLIC_DOWNLOAD_BASE_URL=https://download.sagraph.top
```

## 推送官网修改

```bash
cd sagraph-web
git add .
git commit -m "feat: update website"
git push
```

Cloudflare Pages 会在 `main` 分支更新后自动构建 `sagraph-web/`。

## Worker 项目配置

Worker 不通过 Pages 构建。进入仓库根目录的 API 项目：

```bash
cd sagraph-api
pnpm install
pnpm check
pnpm deploy
```

Worker 项目已经绑定：

```text
api.sagraph.top
download.sagraph.top
RELEASES_BUCKET -> sagraph-releases
```

如果使用 Dashboard 编辑器部署，则选择已有的 `sagraph-api` Worker，不要创建新 Worker。
