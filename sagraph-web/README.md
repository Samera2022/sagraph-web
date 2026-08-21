# saGraph 官网

这是 saGraph 的 Astro 官网项目，部署目标是 Cloudflare Pages。

## 本地开发

```bash
cd sagraph-web
pnpm install
pnpm dev
```

构建检查：

```bash
pnpm check
pnpm build
```

手动部署到现有 Cloudflare Pages 项目：

```bash
pnpm run deploy
```

日常推送到 `main` 时，Cloudflare Git Integration 会自动部署；手动命令用于重新发布或排查 Git Integration。

## Cloudflare Pages

Cloudflare Pages 连接本仓库时填写：

```text
Project name: sagraph-web
Production branch: main
Framework preset: Astro
Root directory: sagraph-web
Build command: pnpm build
Build output directory: dist
Node.js version: 22
```

因为 `sagraph-web` 是仓库中的子目录，Root directory 必须填写 `sagraph-web`。构建输出目录 `dist` 是相对于该目录的路径，不要填写 `sagraph-web/dist`。

Production 环境变量：

```text
NODE_VERSION=22
PUBLIC_SITE_URL=https://www.sagraph.top
PUBLIC_API_BASE_URL=https://api.sagraph.top
PUBLIC_DOWNLOAD_BASE_URL=https://download.sagraph.top
```

这些 `PUBLIC_*` 变量会进入浏览器，不能填写私钥、密码或访问令牌。
