# sagraph-api

Cloudflare Worker，负责：

- Tauri 更新检查与 R2 下载代理
- PayPal 创建订单和捕获付款
- 使用 saGraph 现有 RSA 格式签发激活码
- D1 PayPal 订单和许可证更新授权
- 直接验证桌面客户端提交的本地许可证明

## 资源

```text
Worker: sagraph-api
R2: sagraph-releases -> RELEASES_BUCKET
D1: sagraph-commerce -> DB
API: https://api.sagraph.top
Download: https://download.sagraph.top
```

## 初始化 D1

```bash
pnpm exec wrangler d1 create sagraph-commerce
```

把输出中的 `database_id` 按 `wrangler.d1.example.toml` 加入 `wrangler.toml`，然后执行：

```bash
pnpm run db:migrate:remote
```

## Secrets

```bash
pnpm exec wrangler secret put PAYPAL_CLIENT_SECRET
pnpm exec wrangler secret put LICENSE_SIGNING_PRIVATE_KEY
```

普通 variables：

```text
PAYPAL_CLIENT_ID
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com   # 测试
REQUIRE_LICENSE=0
```

正式上线 PayPal 后把 base URL 改成：

```text
https://api-m.paypal.com
```

`LICENSE_SIGNING_PRIVATE_KEY` 填 `license-keys/saGraph_license_private.pem` 的完整内容，不是 Tauri updater 私钥。

## 开发与部署

```bash
pnpm install
pnpm check
pnpm dev
pnpm run deploy
```

只有在 D1、PayPal、激活和客户端 headers 端到端验证后才设置：

```text
REQUIRE_LICENSE=1
```
