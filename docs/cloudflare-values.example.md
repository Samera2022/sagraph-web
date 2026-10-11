# Cloudflare 配置检查表

```text
Pages project: sagraph-web
Worker project: sagraph-api
R2 bucket: sagraph-releases
D1 database: sagraph-commerce
```

## 先区分三类配置

- **GitHub Actions Secret**：只给自动构建/发布流水线使用。
- **Worker Secret**：只给线上 `sagraph-api` Worker 使用，不能放 Pages 或 R2。
- **Worker Variable**：给 Worker 使用的非敏感配置，例如地址、开关、公开 Client ID。

## GitHub Actions Secrets：桌面仓库（`Samera2022/saGraph-charged`）

```text
[ ] TAURI_SIGNING_PRIVATE_KEY              # Tauri 更新包签名私钥
[ ] TAURI_SIGNING_PRIVATE_KEY_PASSWORD     # 上述私钥的密码；无密码留空
[ ] CLOUDFLARE_R2_UPLOAD_TOKEN             # CI 上传发布包到 R2 的 Cloudflare API Token
[ ] CLOUDFLARE_ACCOUNT_ID                  # Cloudflare 账户 ID，不是密码
[ ] VIRUSTOTAL_API_KEY                     # VirusTotal 扫描 Token，可选
```

`CLOUDFLARE_R2_UPLOAD_TOKEN` 不是 R2 的 Access Key，也不是 Secret Access Key。
它是一个 Cloudflare API Token，作用是允许 GitHub Actions 使用 Wrangler 把发布包、`.sig`、catalog 和安全报告上传到 R2。
获取方式：Cloudflare Dashboard → My Profile → API Tokens → Create Token；给它最小的 R2 Object Read & Write 权限，并限制到 `sagraph-releases` bucket。
填写位置：桌面仓库 `Samera2022/saGraph-charged` → Settings → Secrets and variables → Actions → New repository secret，名称必须为 `CLOUDFLARE_R2_UPLOAD_TOKEN`。

## GitHub Actions Secrets：web 仓库

```text
[ ] CLOUDFLARE_WORKERS_DEPLOY_TOKEN        # CI 部署 Worker 的 Cloudflare API Token
[ ] CLOUDFLARE_ACCOUNT_ID                  # Cloudflare 账户 ID
[ ] CLOUDFLARE_D1_DATABASE_ID              # D1 数据库 ID，不是 Secret
```

`CLOUDFLARE_WORKERS_DEPLOY_TOKEN` 的作用是允许 web 仓库的 GitHub Actions 部署 `sagraph-api` Worker 并执行 D1 迁移。
获取方式：Cloudflare Dashboard → My Profile → API Tokens → Create Token；至少授予该账户下 Workers Scripts 编辑权限和 D1 编辑权限。
填写位置：web 仓库 GitHub → Settings → Secrets and variables → Actions。

`CLOUDFLARE_D1_DATABASE_ID` 的作用是告诉 CI 要迁移和绑定哪一个 D1 数据库。
获取方式：运行 `pnpm exec wrangler d1 create sagraph-commerce`，复制输出的 `database_id`。
填写位置：web 仓库 GitHub Actions Secret，名称必须为 `CLOUDFLARE_D1_DATABASE_ID`。

## Worker Secrets

```text
[ ] PAYPAL_CLIENT_SECRET                    # PayPal REST API 身份认证密钥
[ ] LICENSE_SIGNING_PRIVATE_KEY             # 签发 saGraph 激活码的 RSA 私钥
```

`PAYPAL_CLIENT_SECRET` 的作用是让 Worker 以服务器身份调用 PayPal REST API，不能暴露到 Pages 或浏览器。
获取方式：PayPal Developer Dashboard → My Apps & Credentials → 对应 Sandbox/Live App → Secret。
填写位置：Cloudflare Dashboard → Workers & Pages → `sagraph-api` → Settings → Variables and Secrets → Secret，或运行 `pnpm exec wrangler secret put PAYPAL_CLIENT_SECRET`。

`LICENSE_SIGNING_PRIVATE_KEY` 的作用是用 RSA 私钥签发激活码；桌面客户端内置对应公钥来验证激活码。
获取方式：使用项目已有的 `license-keys/saGraph_license_private.pem`，不能重新生成另一把，否则客户端会拒绝激活码。
填写位置：`sagraph-api` Worker Secret。绝不能放 Git、Pages、R2 或浏览器。

## Worker Variables

```text
[ ] PAYPAL_CLIENT_ID                       # PayPal 应用公开 Client ID
[ ] PAYPAL_BASE_URL                       # PayPal Sandbox 或 Live API 地址
[ ] REQUIRE_LICENSE=0                     # 是否强制更新携带本地许可证明
```

`PAYPAL_CLIENT_ID` 的作用是让浏览器加载 PayPal Buttons SDK，并让 Worker 创建订单时声明使用哪个 PayPal 应用。
获取方式：PayPal Developer Dashboard 对应 App 的 Client ID。
填写位置：`sagraph-api` Worker Variable；它不是私钥，可以公开给购买页面。

`PAYPAL_BASE_URL` 的作用是选择 PayPal API 环境：测试使用 `https://api-m.sandbox.paypal.com`，正式环境使用 `https://api-m.paypal.com`。
填写位置：`sagraph-api` Worker Variable。

`REQUIRE_LICENSE` 的作用是控制更新检查和下载是否必须携带 `X-SaGraph-License-Proof`。
它不是密钥，也不需要获取；测试阶段填 `0`，确认客户端头部传递正常后改成 `1`。

不再需要更新会话 Token 或 Microsoft Store 服务端凭据。Store 更新授权直接信任 Rust/Tauri 客户端本地验证结果；D1 仍只记录 PayPal 订单。

不再需要 `CHANGELOG_SIGNING_PRIVATE_KEY`。
