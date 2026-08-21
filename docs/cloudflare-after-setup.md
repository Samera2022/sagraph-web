# Cloudflare 基础资源创建完成后的操作手册

本文从以下状态开始：

- 域名 `sagraph.top` 已加入 Cloudflare。
- Astro 官网已经部署到 Cloudflare Pages。
- Pages 已绑定 `sagraph.top`。
- Worker 项目名称为 `sagraph-api`。
- `api.sagraph.top` 已作为 Custom Domain 绑定到 `sagraph-api`。
- R2 bucket 名称为 `sagraph-releases`。
- Worker 已通过变量 `RELEASES_BUCKET` 绑定 `sagraph-releases`。

如果以上内容均已完成，Cloudflare 的基础设施已经准备好了。接下来要做的核心工作不是继续创建资源，而是：

1. 检查现有绑定是否可访问。
2. 设置 Pages 的正式环境变量。
3. 给 `sagraph-api` 部署真正的更新 API 代码。
4. 规定 R2 中安装包和元数据的目录结构。
5. 配置签名密钥和发布凭据。
6. 修改桌面客户端的更新地址。
7. 上传一次测试版本并完成端到端升级。

---

## 1. 检查当前资源

### 1.1 检查 Pages 官网

浏览器访问：

```text
https://sagraph.top
```

继续检查：

```text
https://sagraph.top/changelog
https://sagraph.top/download
https://sagraph.top/docs
https://sagraph.top/privacy
https://sagraph.top/terms
```

应当满足：

- HTTPS 证书正常。
- 页面样式正常。
- 页面之间可以跳转。
- 地址栏最终保持 `sagraph.top`，而不是意外跳回 `pages.dev`。

如果 `sagraph.top` 无法访问，进入：

```text
Cloudflare Dashboard
→ Workers & Pages
→ sagraph-web
→ Custom domains
```

确认 `sagraph.top` 的状态为 `Active`。

### 1.2 检查 Worker 域名

浏览器访问：

```text
https://api.sagraph.top
```

此时可能仍然显示 Hello World、默认文本或当前 Worker 的临时代码。这没有问题，只要不是 DNS、证书或 `404 host` 错误，就说明 Custom Domain 已生效。

也可以执行：

```bash
curl -i https://api.sagraph.top/
```

现在不要求返回最终 API 内容。真正的 Worker 代码部署后，根路径将返回服务信息，健康检查接口将位于：

```text
https://api.sagraph.top/health
```

### 1.3 检查 R2 binding

进入：

```text
Cloudflare Dashboard
→ Workers & Pages
→ sagraph-api
→ Settings
→ Bindings
```

确认存在：

```text
Type: R2 bucket
Variable name: RELEASES_BUCKET
Bucket: sagraph-releases
```

变量名必须严格为 `RELEASES_BUCKET`。大小写不同会导致 Worker 代码找不到 bucket。

### 1.4 检查 R2 没有公开

进入：

```text
Cloudflare Dashboard
→ R2 Object Storage
→ sagraph-releases
→ Settings
```

确认：

```text
Public Development URL / r2.dev: Disabled
Custom Domains: 不绑定
```

安装包通过 Worker 返回，不应直接公开整个 bucket。

---

## 2. 设置 Pages 正式环境变量

进入：

```text
Cloudflare Dashboard
→ Workers & Pages
→ sagraph-web
→ Settings
→ Environment variables
```

在 `Production` 环境填写：

```text
NODE_VERSION=22
PUBLIC_SITE_URL=https://sagraph.top
PUBLIC_API_BASE_URL=https://api.sagraph.top
PUBLIC_DOWNLOAD_BASE_URL=https://api.sagraph.top
```

目前没有必要单独创建 `download.sagraph.top`。下载接口可以先放在：

```text
https://api.sagraph.top/api/v1/releases/...
```

以后如果确实需要独立下载域名，再把 `download.sagraph.top` 作为第二个 Custom Domain 绑定到同一个 Worker。

这些变量都是公开地址。不要在 Pages 中填写：

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
CHANGELOG_SIGNING_PRIVATE_KEY
LICENSE_SIGNING_PRIVATE_KEY
UPDATE_TOKEN_SECRET
CLOUDFLARE_API_TOKEN
R2_SECRET_ACCESS_KEY
```

保存变量后，进入 Pages 项目的 `Deployments` 页面，对最新生产部署选择：

```text
Retry deployment
```

也可以向官网仓库推送一个新提交触发重新部署。

重新部署完成后，再访问：

```text
https://sagraph.top
```

---

## 3. 下一项开发工作：实现 `sagraph-api`

当前 Worker 只有 Cloudflare 项目和 R2 binding，还没有真正的版本判断、签名读取和下载逻辑。

推荐把 Worker 作为独立源码项目管理，而不是长期在 Dashboard 编辑器中手工修改。建议仓库结构：

```text
sagraph-api/
├── src/
│   └── index.ts
├── test/
├── package.json
├── tsconfig.json
└── wrangler.toml
```

`wrangler.toml` 至少需要：

```toml
name = "sagraph-api"
main = "src/index.ts"
compatibility_date = "2026-08-21"

[[routes]]
pattern = "api.sagraph.top"
custom_domain = true

[[r2_buckets]]
binding = "RELEASES_BUCKET"
bucket_name = "sagraph-releases"
```

如果 Custom Domain 和 R2 binding 已经在 Dashboard 建好，第一次使用 Wrangler 部署前仍要检查配置中的名称与 Dashboard 完全一致，避免部署时创建错误资源。

Worker 第一阶段应实现以下接口：

```text
GET /                           服务基本信息
GET /health                     健康检查
GET /api/v1/updates/:target/:arch/:currentVersion
GET /api/v1/changelog/manifest
GET /api/v1/releases/:version/:target/:arch/:filename
```

第二阶段再实现付费授权：

```text
POST /api/v1/update-sessions
```

### 3.1 健康检查

请求：

```http
GET /health
```

返回：

```json
{
  "ok": true,
  "service": "sagraph-api"
}
```

验证：

```bash
curl -i https://api.sagraph.top/health
```

期望状态码：

```text
200 OK
```

### 3.2 更新检查

请求格式：

```http
GET /api/v1/updates/{target}/{arch}/{current_version}
```

例如：

```text
https://api.sagraph.top/api/v1/updates/windows/x86_64/0.1.0
```

如果没有更新，返回：

```http
204 No Content
```

如果存在更新，返回：

```json
{
  "version": "0.2.0",
  "notes": "新增自动更新和更新日志界面。",
  "pub_date": "2026-08-21T12:00:00Z",
  "url": "https://api.sagraph.top/api/v1/releases/0.2.0/windows/x86_64/saGraph_0.2.0_x64-setup.nsis.zip",
  "signature": "TAURI_GENERATED_SIGNATURE_TEXT"
}
```

Worker 必须比较语义版本号，不能按普通字符串比较。例如 `0.10.0` 必须高于 `0.9.0`。

### 3.3 更新日志 manifest

请求：

```http
GET /api/v1/changelog/manifest
```

返回：

```json
{
  "signed_payload": "{\"sha256\":\"...\",\"document\":{\"versions\":[]}}",
  "signature": "BASE64_RSA_SHA256_SIGNATURE"
}
```

这个接口返回已经签名的完整文件。第一阶段不需要让公开 API Worker 在每次请求时重新签名。

### 3.4 安装包下载

请求：

```http
GET /api/v1/releases/{version}/{target}/{arch}/{filename}
```

Worker 使用绑定读取：

```ts
const object = await env.RELEASES_BUCKET.get(objectKey);
```

然后把对象 body、content type、content length、ETag 和合理的缓存头返回给客户端。

Worker 只能提供 `GET` 和必要的 `HEAD`。公开接口不能提供任意 `PUT`、`DELETE` 或列出整个 bucket 的能力。

---

## 4. R2 文件结构

不要把文件随意放在 bucket 根目录。使用固定结构：

```text
metadata/stable.json
changelog/manifest.json

releases/0.2.0/windows/x86_64/saGraph_0.2.0_x64-setup.nsis.zip
releases/0.2.0/windows/x86_64/saGraph_0.2.0_x64-setup.nsis.zip.sig

releases/0.2.0/linux/x86_64/saGraph_0.2.0_amd64.AppImage.tar.gz
releases/0.2.0/linux/x86_64/saGraph_0.2.0_amd64.AppImage.tar.gz.sig
```

`metadata/stable.json` 用于告诉 Worker 当前稳定版本及每个平台的对象位置。建议格式：

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

发布时必须先上传安装包和 `.sig`，确认文件可读取后，最后才覆盖 `metadata/stable.json`。这样可以避免客户端看到一个尚未上传完整的新版本。

---

## 5. 密钥和 Secret 应该放在哪里

### 5.1 Tauri Updater 私钥

对应本地文件：

```text
license-keys/updater.key
```

用途：构建安装包时生成 Tauri `.sig`。

推荐位置：

```text
GitHub 仓库
→ Settings
→ Secrets and variables
→ Actions
```

Secret 名称：

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

不要把 updater 私钥绑定给公开的 `sagraph-api` Worker。API Worker只需要读取已经生成的 `.sig` 文件。

如果一定要把 updater 私钥保存在 Cloudflare Secrets Store，就需要额外建立一个不公开的签名服务，并通过受保护的 CI 身份调用它。不能让 `api.sagraph.top` 的普通请求处理代码访问这把私钥。

### 5.2 更新日志私钥

对应本地文件：

```text
license-keys/changelog-private.pem
```

用途：生成 `changelog/manifest.json` 的签名。

第一阶段推荐在发布 CI 中签名，然后把最终 manifest 上传到 R2。这样公开 Worker 不需要长期持有更新日志私钥。

如果后续由 Cloudflare 内部管理后台发布更新日志，可以把它放入 Cloudflare Secrets Store，但只绑定给独立的管理/签名 Worker，不绑定给普通下载 Worker。

### 5.3 更新令牌 Secret

实现付费更新会话时，需要：

```text
UPDATE_TOKEN_SECRET
```

可在本地生成：

```bash
openssl rand -base64 48
```

然后进入：

```text
Cloudflare Dashboard
→ Workers & Pages
→ sagraph-api
→ Settings
→ Variables and Secrets
→ Add
```

填写：

```text
Type: Secret
Variable name: UPDATE_TOKEN_SECRET
Value: 上一条命令生成的随机字符串
```

点击 `Deploy` 使 Secret 生效。

第一阶段尚未实现 `POST /api/v1/update-sessions` 时，可以暂时不添加这个 Secret。

### 5.4 Cloudflare 发布 Token

发布 CI 需要向 R2 上传安装包并部署 Worker时，创建一个最小权限 Cloudflare API Token。不要使用 Global API Key。

建议拆成两个 Token：

```text
SAGRAPH_WORKER_DEPLOY_TOKEN
SAGRAPH_R2_UPLOAD_TOKEN
```

Worker Token 只授予部署 `sagraph-api` 所需权限；R2 Token 只授予 `sagraph-releases` 对象读写权限。将它们保存在 GitHub Actions Secrets 中，不放进 Pages 或前端代码。

---

## 6. 修改桌面客户端地址

当前桌面程序仍使用占位 endpoint：

```text
https://updates.sagraph.example/api/v1/updates/{{target}}/{{arch}}/{{current_version}}
```

Worker API 部署并验证后，把桌面程序的 `src-tauri/tauri.conf.json` 改为：

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://api.sagraph.top/api/v1/updates/{{target}}/{{arch}}/{{current_version}}"
      ]
    }
  }
}
```

桌面程序构建环境还要设置：

```text
VITE_CHANGELOG_MANIFEST_URL=https://api.sagraph.top/api/v1/changelog/manifest
```

这些地址不是秘密，可以放在构建环境变量中。

不要在 Worker 尚未实现时提前发布使用正式 endpoint 的桌面版本，否则“检查更新”会请求到 Hello World 或错误响应。

---

## 7. 第一阶段与付费授权阶段

### 第一阶段：完成更新链路

先实现：

- Worker 读取 `metadata/stable.json`。
- Worker 比较客户端版本。
- Worker 返回 Tauri Updater JSON。
- Worker 从 R2 返回安装包。
- Worker 返回签名更新日志 manifest。
- 客户端完成一次从旧版本到新版本的真实升级。

这个阶段更新检查接口可以不要求许可证 Token，但安装包仍必须通过 Tauri 签名验证。

### 第二阶段：加入付费授权

再实现：

1. 客户端用许可证和设备信息请求 `POST /api/v1/update-sessions`。
2. Worker 验证许可证是否有效、是否包含该版本和发行渠道。
3. Worker 返回有效期 5–30 分钟的短期 Token。
4. 客户端使用 Token 检查和下载更新。
5. Worker 拒绝过期、篡改或权限不足的 Token。

当前客户端直接调用 `check()`，尚未向 Updater 请求附加授权头。因此在启用强制 Token 前，还需要修改客户端更新调用逻辑。

---

## 8. 第一次发布的正确顺序

以 `0.2.0` 为例：

1. 修改桌面程序版本号。
2. 更新内置更新日志。
3. 使用 Tauri 构建各平台更新包。
4. 使用 updater 私钥生成 `.sig`。
5. 计算并记录安装包 SHA-256。
6. 生成并签名 `changelog/manifest.json`。
7. 上传所有安装包到 R2。
8. 上传所有 `.sig` 到 R2。
9. 上传 `changelog/manifest.json`。
10. 使用 Worker 的内部读取逻辑确认所有对象都存在。
11. 最后上传或覆盖 `metadata/stable.json`。
12. 请求更新检查接口，确认旧版本得到 `200`。
13. 请求当前版本，确认得到 `204`。
14. 使用已安装的旧版程序执行真实更新。
15. 验证下载、签名检查、安装、重启和版本号。

不允许先发布 `metadata/stable.json` 再慢慢上传安装包。

---

## 9. API 部署后的测试命令

### 健康检查

```bash
curl -i https://api.sagraph.top/health
```

### 检查旧版本是否获得更新

```bash
curl -i https://api.sagraph.top/api/v1/updates/windows/x86_64/0.1.0
```

预期：

```text
HTTP 200
Content-Type: application/json
```

### 检查最新版本是否无更新

```bash
curl -i https://api.sagraph.top/api/v1/updates/windows/x86_64/0.2.0
```

预期：

```text
HTTP 204
```

### 检查更新日志

```bash
curl -i https://api.sagraph.top/api/v1/changelog/manifest
```

### 检查不存在的文件

```bash
curl -i https://api.sagraph.top/api/v1/releases/9.9.9/windows/x86_64/not-found.zip
```

预期：

```text
HTTP 404
```

---

## 10. 你当前真正的下一步

现在不需要继续创建 Cloudflare 资源，也暂时不需要上传私钥。

下一步应当是：

```text
创建 sagraph-api Worker 源码项目
→ 实现 /health
→ 实现读取 R2 metadata/stable.json
→ 实现 Tauri 更新检查接口
→ 实现 R2 安装包下载接口
→ 实现更新日志 manifest 接口
→ 部署到现有 sagraph-api Worker
```

完成 Worker API 后，才进行：

```text
上传测试发布文件
→ 修改客户端 endpoint
→ 构建旧版和新版
→ 执行真实自动更新测试
```

不要在 Worker 代码完成之前公开正式版本元数据，也不要把私钥上传到 Pages、R2 或 Git 仓库。
