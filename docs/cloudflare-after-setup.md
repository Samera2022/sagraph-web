# Cloudflare 后续实施手册

当前基础设施已经完成：

```text
Pages project: sagraph-web
Website: https://www.sagraph.top
Worker: sagraph-api
API: https://api.sagraph.top
Download: https://download.sagraph.top
R2 bucket: sagraph-releases
R2 binding: RELEASES_BUCKET
```

本文不再介绍资源创建、域名绑定或连通性验证，只说明接下来如何开发、部署和发布更新。

## 1. 仓库结构

```text
web/
├── sagraph-web/  Astro Pages 项目
├── sagraph-api/  Cloudflare Worker 项目
└── docs/         共用部署与协议文档
```

Cloudflare Pages 的 Root directory 必须改成：

```text
sagraph-web
```

Pages 的其他构建设置：

```text
Build command: pnpm build
Build output directory: dist
NODE_VERSION: 22
```

Production 环境变量：

```text
PUBLIC_SITE_URL=https://www.sagraph.top
PUBLIC_API_BASE_URL=https://api.sagraph.top
PUBLIC_DOWNLOAD_BASE_URL=https://download.sagraph.top
```

修改 Root directory 后重新部署一次 Pages。

## 2. 部署 Worker 项目

Worker 源码位于：

```text
sagraph-api/
```

安装依赖并检查：

```bash
cd sagraph-api
pnpm install
pnpm check
```

首次使用 Wrangler 时登录：

```bash
pnpm wrangler login
```

部署到现有 `sagraph-api` Worker：

```bash
pnpm deploy
```

`wrangler.toml` 已包含：

```text
api.sagraph.top       -> sagraph-api
download.sagraph.top  -> sagraph-api
RELEASES_BUCKET       -> sagraph-releases
```

当前基础代码提供：

```text
GET  https://api.sagraph.top/
GET  https://api.sagraph.top/health
GET  https://download.sagraph.top/api/v1/releases/<version>/<target>/<arch>/<filename>
HEAD https://download.sagraph.top/api/v1/releases/<version>/<target>/<arch>/<filename>
```

部署后测试：

```bash
curl -i https://api.sagraph.top/health
```

预期响应：

```json
{
  "ok": true,
  "service": "sagraph-api"
}
```

## 3. Worker 待实现接口

下一阶段在 `sagraph-api/src/index.ts` 实现：

```text
GET /api/v1/updates/:target/:arch/:currentVersion
GET /api/v1/changelog/manifest
POST /api/v1/update-sessions
```

### 3.1 更新检查

请求：

```text
https://api.sagraph.top/api/v1/updates/windows/x86_64/0.1.0
```

没有更新时：

```http
204 No Content
```

有更新时：

```json
{
  "version": "0.2.0",
  "notes": "新增自动更新和更新日志界面。",
  "pub_date": "2026-08-21T12:00:00Z",
  "url": "https://download.sagraph.top/api/v1/releases/0.2.0/windows/x86_64/saGraph_0.2.0_x64-setup.nsis.zip",
  "signature": "TAURI_GENERATED_SIGNATURE_TEXT"
}
```

版本必须使用语义版本规则比较，不能按普通字符串比较。

### 3.2 更新日志

请求：

```text
https://api.sagraph.top/api/v1/changelog/manifest
```

响应：

```json
{
  "signed_payload": "{\"sha256\":\"...\",\"document\":{\"versions\":[]}}",
  "signature": "BASE64_RSA_SHA256_SIGNATURE"
}
```

公开 Worker 只读取已经签名的 manifest，不应在每个请求中使用私钥重新签名。

### 3.3 更新会话

付费更新授权使用：

```http
POST /api/v1/update-sessions
```

客户端提交许可证、设备、当前版本、平台、架构和渠道。Worker 验证后返回有效期 5–30 分钟的短期 Token。

此接口应在基础更新链路完成后再实现。

## 4. R2 对象结构

使用固定 key：

```text
metadata/stable.json
changelog/manifest.json

releases/0.2.0/windows/x86_64/saGraph_0.2.0_x64-setup.nsis.zip
releases/0.2.0/windows/x86_64/saGraph_0.2.0_x64-setup.nsis.zip.sig

releases/0.2.0/linux/x86_64/saGraph_0.2.0_amd64.AppImage.tar.gz
releases/0.2.0/linux/x86_64/saGraph_0.2.0_amd64.AppImage.tar.gz.sig
```

`metadata/stable.json` 示例：

```json
{
  "channel": "stable",
  "version": "0.2.0",
  "pub_date": "2026-08-21T12:00:00Z",
  "notes": "新增自动更新和更新日志界面。",
  "platforms": {
    "windows-x86_64": {
      "artifact": "releases/0.2.0/windows/x86_64/saGraph_0.2.0_x64-setup.nsis.zip",
      "signature": "releases/0.2.0/windows/x86_64/saGraph_0.2.0_x64-setup.nsis.zip.sig"
    },
    "linux-x86_64": {
      "artifact": "releases/0.2.0/linux/x86_64/saGraph_0.2.0_amd64.AppImage.tar.gz",
      "signature": "releases/0.2.0/linux/x86_64/saGraph_0.2.0_amd64.AppImage.tar.gz.sig"
    }
  }
}
```

发布时按以下顺序：

1. 上传安装包。
2. 上传对应 `.sig`。
3. 上传签名更新日志 manifest。
4. 确认所有对象存在。
5. 最后覆盖 `metadata/stable.json`。

不能先发布新 metadata 再上传安装包。

## 5. 密钥位置

### Tauri Updater 私钥

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

只放在构建安装包的 GitHub Actions 或其他发布 CI Secret 中。不要绑定给 `sagraph-api` Worker。

### 更新日志私钥

```text
CHANGELOG_SIGNING_PRIVATE_KEY
```

第一阶段同样建议放在发布 CI 中。CI 生成签名 manifest 后上传 R2，公开 Worker 只负责读取。

### 更新令牌 Secret

实现付费更新会话时再给 Worker 添加：

```text
UPDATE_TOKEN_SECRET
```

可生成：

```bash
openssl rand -base64 48
```

在 Cloudflare Worker 的 Variables and Secrets 中以 `Secret` 类型添加。

## 6. 修改客户端地址

Worker 更新接口完成并部署后，将桌面程序的 updater endpoint 改为：

```text
https://api.sagraph.top/api/v1/updates/{{target}}/{{arch}}/{{current_version}}
```

桌面程序构建环境设置：

```text
VITE_CHANGELOG_MANIFEST_URL=https://api.sagraph.top/api/v1/changelog/manifest
```

Worker 尚未实现更新检查接口之前，不要发布使用正式 endpoint 的客户端版本。

## 7. 第一次端到端更新测试

以 `0.1.0` 更新到 `0.2.0` 为例：

1. 保留一份已安装的 `0.1.0`。
2. 将桌面项目版本改为 `0.2.0`。
3. 构建并使用 Tauri updater 私钥签名。
4. 上传更新包和 `.sig` 到 R2。
5. 生成并上传签名更新日志 manifest。
6. 最后上传 `metadata/stable.json`。
7. 请求旧版本更新接口，确认返回 `200` 和 `0.2.0`。
8. 请求 `0.2.0` 更新接口，确认返回 `204`。
9. 在 `0.1.0` 客户端中执行检查、下载和安装。
10. 验证签名、安装、重启和最终版本号。

测试命令：

```bash
curl -i https://api.sagraph.top/api/v1/updates/windows/x86_64/0.1.0
curl -i https://api.sagraph.top/api/v1/updates/windows/x86_64/0.2.0
curl -i https://api.sagraph.top/api/v1/changelog/manifest
curl -I https://download.sagraph.top/api/v1/releases/0.2.0/windows/x86_64/<文件名>
```
