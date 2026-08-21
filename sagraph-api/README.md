# sagraph-api

Cloudflare Worker，负责版本检查、更新日志 manifest 和 R2 安装包下载。

## Cloudflare 现有资源

```text
Worker: sagraph-api
API domain: https://api.sagraph.top
Download domain: https://download.sagraph.top
R2 bucket: sagraph-releases
R2 binding: RELEASES_BUCKET
```

这些资源已经创建并绑定。部署 Worker 时不要重新创建同名 Worker 或 bucket。

## 本地开发

```bash
cd sagraph-api
pnpm install
pnpm check
pnpm dev
```

## 部署

登录 Cloudflare：

```bash
pnpm wrangler login
```

部署到现有 Worker：

```bash
pnpm deploy
```

`wrangler.toml` 中已经声明：

```text
api.sagraph.top       -> sagraph-api
download.sagraph.top -> sagraph-api
RELEASES_BUCKET       -> sagraph-releases
```

## 当前路由

```text
GET  https://api.sagraph.top/
GET  https://api.sagraph.top/health
GET  https://download.sagraph.top/api/v1/releases/<version>/<target>/<arch>/<filename>
HEAD https://download.sagraph.top/api/v1/releases/<version>/<target>/<arch>/<filename>
```

R2 对象路径映射示例：

```text
/api/v1/releases/0.2.0/windows/x86_64/file.zip
→ releases/0.2.0/windows/x86_64/file.zip
```

更新检查和更新日志接口将在此项目继续实现。
