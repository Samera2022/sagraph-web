# Cloudflare 当前架构

## Pages

```text
Project: sagraph-web
Root directory: sagraph-web
Build command: pnpm build
Build output: dist
Domain: https://www.sagraph.top
```

官网包含：

```text
/purchase   PayPal 购买和自动生成激活码
/activate   使用已完成 PayPal 订单补发激活码
/download   下载页面
/changelog  发布日志
```

## Worker

```text
Project: sagraph-api
Domain: https://api.sagraph.top
Download domain: https://download.sagraph.top
R2 binding: RELEASES_BUCKET -> sagraph-releases
D1 binding: DB -> sagraph-commerce
```

域名已经由 Cloudflare Dashboard 管理，`wrangler.toml` 不声明 routes。

## 密钥分类

桌面发布仓库 GitHub Actions：

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
CLOUDFLARE_R2_UPLOAD_TOKEN
CLOUDFLARE_ACCOUNT_ID
VIRUSTOTAL_API_KEY（可选）
```

Worker Secrets：

```text
PAYPAL_CLIENT_SECRET
LICENSE_SIGNING_PRIVATE_KEY
```

web 仓库 GitHub Actions 还需要：

```text
CLOUDFLARE_D1_DATABASE_ID
```

Worker Variables：

```text
PAYPAL_CLIENT_ID
PAYPAL_BASE_URL
REQUIRE_LICENSE
```

Microsoft Store 更新授权直接信任桌面客户端本地状态，不读写 D1；D1 只保存官网 PayPal 订单和激活记录。

已经取消：

```text
CHANGELOG_SIGNING_PRIVATE_KEY
VITE_CHANGELOG_MANIFEST_URL
LICENSE_VERIFY_URL
```

详细操作见 `cloudflare-after-setup.md`。
