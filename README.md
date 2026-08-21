# saGraph 官网

这是 saGraph 的 Astro 官网前端。当前版本是静态站点，负责产品介绍、下载入口、文档和更新日志展示。

## 本地开发

```bash
pnpm install
pnpm dev
```

构建检查：

```bash
pnpm check
pnpm build
```

## Cloudflare Pages 部署

在 Cloudflare Dashboard 创建 Pages 项目并连接仓库，填写：

```text
Framework preset: Astro
Root directory: /
Build command: pnpm build
Build output directory: dist
Node.js version: 22
```

Pages 环境变量：

```text
PUBLIC_SITE_URL=https://www.<你的域名>
PUBLIC_API_BASE_URL=https://api.<你的域名>
PUBLIC_DOWNLOAD_BASE_URL=https://download.<你的域名>
```

这些 `PUBLIC_*` 变量会进入浏览器，不能填写任何私钥、密码或访问令牌。

## 推荐域名

```text
www.<你的域名>       Cloudflare Pages 官网
api.<你的域名>       Cloudflare Worker 更新与许可证 API
download.<你的域名>  Worker 控制的安装包下载
admin.<你的域名>     后续管理后台
```

## R2 Object Storage

在 R2 创建 bucket：

```text
sagraph-releases
```

建议对象路径：

```text
releases/<version>/<target>/<arch>/<filename>

releases/0.2.0/windows/x86_64/saGraph_0.2.0_x64-setup.nsis.zip
releases/0.2.0/windows/x86_64/saGraph_0.2.0_x64-setup.nsis.zip.sig
releases/0.2.0/linux/x86_64/saGraph_0.2.0_amd64.AppImage.tar.gz
releases/0.2.0/linux/x86_64/saGraph_0.2.0_amd64.AppImage.tar.gz.sig
```

不要为 bucket 开启完全公开访问。未来 API Worker 通过 R2 binding `RELEASES_BUCKET` 读取对象，在许可证验证后返回文件或受控下载地址。

`wrangler.toml.example` 给出了 Worker binding 示例。创建 Worker 时需要填写：

```text
Binding type: R2 Bucket
Variable name: RELEASES_BUCKET
R2 bucket: sagraph-releases
```

## Cloudflare Secrets

建议使用以下 Secret 名称：

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
CHANGELOG_SIGNING_PRIVATE_KEY
LICENSE_SIGNING_PRIVATE_KEY
DATABASE_URL
UPDATE_TOKEN_SECRET
ADMIN_SESSION_SECRET
```

其中当前本地生成的文件对应：

```text
license-keys/updater.key                 → TAURI_SIGNING_PRIVATE_KEY
license-keys/changelog-private.pem       → CHANGELOG_SIGNING_PRIVATE_KEY
```

不要把私钥放在 Pages 环境变量、`PUBLIC_*` 变量、Astro `public/`、R2 公共对象或 Git 仓库中。Updater 私钥通常只需要 CI/发布签名任务访问；更新检查 Worker 本身只需要读取已经生成的 `.sig` 文件，不一定需要持有 updater 私钥。

## 后续需要填写的 Cloudflare 项目

等域名、R2 和 Worker 创建完成后，需要把以下实际值告诉开发环境：

```text
正式根域名
Pages 项目名称
Worker 项目名称
R2 bucket 名称
API Worker URL
下载域名
是否使用 Cloudflare D1 或外部 PostgreSQL
```

届时还需要修改：

```text
astro.config.mjs 或 Pages 环境变量
桌面程序仓库中 src-tauri/tauri.conf.json 的 updater endpoint
桌面程序构建时的 VITE_CHANGELOG_MANIFEST_URL
```

`docs/updater-api.md` 规定了 Worker 更新 API 的返回格式和授权流程。

Cloudflare Dashboard 的逐项填写说明见：

```text
docs/cloudflare-setup.md
```

部署信息记录模板见：

```text
docs/cloudflare-values.example.md
```

首次推送 GitHub 并绑定 Cloudflare Pages 的逐步说明见：

```text
docs/github-cloudflare-pages.md
```

Pages、Worker、R2 和域名已经创建后的完整后续操作见：

```text
docs/cloudflare-after-setup.md
```
