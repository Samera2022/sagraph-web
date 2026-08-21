# GitHub 与 Cloudflare Pages 首次部署

本仓库是独立的 Astro 官网仓库。Cloudflare Pages 应连接此仓库，而不是桌面程序主仓库，也不需要提交 `dist/`。

## 1. 创建 GitHub 仓库

在 GitHub 创建公开空仓库：

```text
Repository name: sagraph-web
Visibility: Public
Initialize with README: No
Add .gitignore: No
Choose a license: No
```

仓库创建后，在本目录添加远程地址并推送：

```bash
git remote add origin git@github.com:<你的用户名>/sagraph-web.git
git push -u origin main
```

使用 HTTPS 时改为：

```bash
git remote add origin https://github.com/<你的用户名>/sagraph-web.git
git push -u origin main
```

不要执行 `git init`；本目录已经初始化并包含首个提交。

## 2. 创建 Pages 项目

进入 Cloudflare Dashboard：

```text
Workers & Pages
→ Create application
→ Pages
→ Connect to Git
```

授权 Cloudflare 访问 GitHub 后选择 `sagraph-web`，并填写：

```text
Project name: sagraph-web
Production branch: main
Framework preset: Astro
Root directory: /（或留空）
Build command: pnpm build
Build output directory: dist
```

环境变量填写：

```text
NODE_VERSION=22
PUBLIC_SITE_URL=https://sagraph-web.pages.dev
```

尚未创建 API Worker 和正式域名时，不需要填写 `PUBLIC_API_BASE_URL` 和 `PUBLIC_DOWNLOAD_BASE_URL`。

## 3. 首次部署检查

部署完成后打开：

```text
https://sagraph-web.pages.dev
https://sagraph-web.pages.dev/changelog
https://sagraph-web.pages.dev/download
https://sagraph-web.pages.dev/docs
```

确认页面、样式、favicon 和导航均正常。以后向 `main` 分支推送提交，Cloudflare Pages 会触发新的生产部署。

## 4. 绑定正式域名

有正式域名后，在 Pages 项目中进入：

```text
Custom domains
→ Set up a custom domain
```

添加：

```text
www.<你的域名>
```

然后将 Production 环境变量改为：

```text
PUBLIC_SITE_URL=https://www.<你的域名>
PUBLIC_API_BASE_URL=https://api.<你的域名>
PUBLIC_DOWNLOAD_BASE_URL=https://download.<你的域名>
```

修改环境变量后重新部署。`api` 和 `download` 子域名应在 API Worker 创建后绑定给 Worker，不要直接绑定公开 R2 bucket。

## 5. 日常发布

在本仓库目录执行：

```bash
pnpm check
pnpm build
git add .
git commit -m "feat: update website"
git push
```

`node_modules/`、`.astro/`、`dist/` 和 `.env` 已被忽略，不会进入公开仓库。
