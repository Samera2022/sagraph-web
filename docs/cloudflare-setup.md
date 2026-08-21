# Cloudflare 控制台填写清单

本文按首次上线顺序列出 Cloudflare Dashboard 中需要创建的资源和填写的值。示例中的 `<你的域名>`、`<ACCOUNT_ID>`、`<STORE_ID>` 必须替换为真实值；私钥内容不要填入任何带 `PUBLIC_` 前缀的变量。

## 资源总览

建议创建以下资源：

| 类型 | 建议名称 | 用途 |
| --- | --- | --- |
| Pages | `sagraph-web` | Astro 官网 |
| Worker | `sagraph-api` | 更新检查、更新日志和许可证 API |
| R2 bucket | `sagraph-releases` | 安装包、更新包及 `.sig` 文件 |
| Secrets Store | `sagraph-production` | Worker 运行时需要的账户级秘密 |

推荐域名：

```text
www.<你的域名>       -> Pages 官网
api.<你的域名>       -> sagraph-api Worker
download.<你的域名>  -> sagraph-api Worker 的受控下载路由
```

`download` 域名不要直接绑定为公开 R2 bucket。付费程序应由 Worker 验证短期更新令牌，再通过 R2 binding 读取并返回对象。

## Pages

1. Workers & Pages → Create → Pages → Connect to Git。
2. 选择仓库和生产分支。
3. Root directory 填 `/`（留空也可以，表示仓库根目录）。
4. Build command 填 `pnpm build`。
5. Build output directory 填 `dist`。
6. 添加 `NODE_VERSION=22`。
7. 部署完成后绑定 `www.<你的域名>`。

Pages → Settings → Environment variables 中只填写公开值：

```text
PUBLIC_SITE_URL=https://www.<你的域名>
PUBLIC_API_BASE_URL=https://api.<你的域名>
PUBLIC_DOWNLOAD_BASE_URL=https://download.<你的域名>
NODE_VERSION=22
```

Production 和 Preview 可以分别设置。正式域名填 Production；Preview 可以继续使用 Cloudflare 提供的 `pages.dev` 地址。

## R2

1. R2 Object Storage → Create bucket。
2. 名称建议 `sagraph-releases`。
3. Location 选择 Automatic。
4. 默认保持私有，不开启 R2.dev 公共 URL。
5. 后续由发布任务上传安装包和 `.sig` 文件。

对象 key 必须保持稳定并区分平台和架构：

```text
releases/<version>/<target>/<arch>/<artifact>
releases/<version>/<target>/<arch>/<artifact>.sig
```

例如：

```text
releases/0.2.0/windows/x86_64/saGraph_0.2.0_x64-setup.nsis.zip
releases/0.2.0/windows/x86_64/saGraph_0.2.0_x64-setup.nsis.zip.sig
```

上传时建议写入对象 metadata：

```text
version=0.2.0
target=windows
arch=x86_64
channel=stable
sha256=<安装包 SHA-256>
```

`.sig` 是 Tauri Updater 生成的签名文本，不能用对象 SHA-256 替代。

## Secret Store

Cloudflare Dashboard → Secrets Store 中创建账户级 store：

```text
Store name: sagraph-production
```

然后创建秘密。建议首期仅创建 Worker 真正会读取的值：

| Secret name | 绑定到 | 用途 |
| --- | --- | --- |
| `CHANGELOG_SIGNING_PRIVATE_KEY` | 发布/签名 Worker | 签名更新日志 manifest |
| `LICENSE_SIGNING_PRIVATE_KEY` | 许可证 Worker | 签发许可证或授权响应 |
| `UPDATE_TOKEN_SECRET` | API Worker | 生成短期更新令牌 |
| `ADMIN_SESSION_SECRET` | 管理后台 Worker | 管理员会话签名 |
| `DATABASE_URL` | API Worker | 外部数据库连接，使用 D1 时不需要 |

Secret 创建表单按下面填写：

```text
Name: 上表中的名称
Value: 对应秘密的完整内容
Scope: Workers
Comment: sagraph production / <用途> / created 2026-08-21
```

创建秘密后，在 Worker → Settings → Bindings → Add → Secrets Store 中逐项绑定：

```text
Variable name: 与 Secret name 相同
Secret name: 选择对应账户级 secret
```

Worker 代码读取 Secrets Store binding 时需要异步调用，例如：

```ts
const privateKey = await env.CHANGELOG_SIGNING_PRIVATE_KEY.get();
```

Secrets Store 与普通 Worker Secret 二选一即可，不要把同一个秘密同时保存两份。需要多个 Worker 共用或集中轮换时优先使用 Secrets Store；仅单个 Worker 使用时也可以使用 Worker Secret。

## Tauri Updater 私钥

`TAURI_SIGNING_PRIVATE_KEY` 和 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 与普通 API secret 不同：它们用于**构建阶段**给安装包签名，而不是用于客户端下载或更新检查。

推荐做法：

1. 将 updater 私钥保存在执行 `pnpm tauri build` 的 CI Secret 中。
2. 构建任务把它注入 `TAURI_SIGNING_PRIVATE_KEY` 和 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。
3. 构建完成后只把安装包与 `.sig` 上传到 R2。
4. `sagraph-api` Worker 不绑定 updater 私钥，只读取 R2 中已经生成的签名。

如果坚持把 updater 私钥放在 Cloudflare Secrets Store，应只把它绑定给隔离的发布签名 Worker，不能绑定给公开处理更新检查的 `sagraph-api`。同时仍需设计一条受保护的构建产物上传与签名流程；仅把私钥存入 Secret Store 不会自动让 Tauri 构建使用它。

当前本机文件对应关系：

```text
license-keys/updater.key           -> TAURI_SIGNING_PRIVATE_KEY
updater key password               -> TAURI_SIGNING_PRIVATE_KEY_PASSWORD
license-keys/changelog-private.pem -> CHANGELOG_SIGNING_PRIVATE_KEY
```

Updater 私钥一旦丢失，已安装客户端将无法验证由新密钥签名的后续更新，因此必须保留至少一份离线加密备份。

## Worker Secrets 命令行方式

Updater 私钥建议优先放在发布 CI，而不是长期放在更新检查 Worker。若必须由 Cloudflare 签名服务读取，则创建独立 Worker 并限制调用权限。

通过 Wrangler 添加 Worker secret 时：

```bash
npx wrangler secret put CHANGELOG_SIGNING_PRIVATE_KEY
npx wrangler secret put LICENSE_SIGNING_PRIVATE_KEY
npx wrangler secret put UPDATE_TOKEN_SECRET
npx wrangler secret put ADMIN_SESSION_SECRET
```

输入提示出现后再粘贴密钥内容，不要把值写进 shell history、`wrangler.toml` 或截图。

以上命令创建的是单 Worker Secret。已经使用 Secrets Store 时，不需要再运行对应的 `wrangler secret put`。

## R2 Binding

在 Worker → Settings → Bindings 中添加：

```text
Type: R2 bucket
Variable name: RELEASES_BUCKET
Bucket: sagraph-releases
```

Worker 代码中通过 `env.RELEASES_BUCKET` 访问对象。

R2 binding 本身已经包含访问能力，不需要把 R2 access key 或 secret key放入 Worker。只有外部 CI 通过 S3 API 上传产物时，才需要单独创建最小权限的 R2 API token。

## Worker 域名

Worker → Settings → Domains & Routes 中添加：

```text
api.<你的域名>
download.<你的域名>
```

两个域名可以指向同一个 Worker，并由请求 host/path 区分 API 和下载。不要同时把 `download.<你的域名>` 直接绑定到 R2 公共域名，否则会绕过许可证检查。

## 首次发布时需要填写的数据

发布 `0.2.0` 前准备一份版本记录：

```text
version: 0.2.0
channel: stable
published_at: <ISO 8601 UTC 时间>
notes: <更新日志摘要>
minimum_supported_version: 0.1.0
force_update: false
```

每个平台产物记录：

```text
target: windows | linux | darwin
arch: x86_64 | aarch64
artifact_key: releases/0.2.0/<target>/<arch>/<文件名>
signature_key: releases/0.2.0/<target>/<arch>/<文件名>.sig
sha256: <安装包 SHA-256>
size: <字节数>
```

更新 API 返回的 `signature` 应是 `.sig` 文件的文本内容，`url` 应是 API Worker 发放的 HTTPS 下载 URL，而不是 R2 控制台中的对象地址。

## 正式上线前

- 替换所有 `.example` 域名。
- 配置 HTTPS 自定义域名。
- 为管理员后台启用 Cloudflare Access 或等效强认证。
- 确认安装包、签名和版本号一致。
- 确认 Pages 中没有任何私密变量。
- 确认 R2 bucket 保持私有。
- 配置日志、告警、备份和密钥轮换方案。
- 为 updater 私钥保留离线加密备份并测试恢复。
- 为 R2 上传 token 限制到 `sagraph-releases`，只授予必要的对象读写权限。
- 在正式发布前用旧版本客户端完成一次真实升级测试。
