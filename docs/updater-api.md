# saGraph Worker API

## 更新

```text
GET  /api/v1/updates/{target}/{arch}/{current_version}
GET  /api/v1/releases/catalog
GET  https://download.sagraph.top/<object key>   # R2 custom domain, e.g. releases/0.2.0/windows/x86_64/<file>
```

`releases/catalog.json` 是普通 JSON，只包含已发布 release entries。更新包仍由 Tauri `.sig` 验证。

启用 `REQUIRE_LICENSE=1` 后，检查与下载都要求请求头：

```http
X-SaGraph-License-Proof: <base64url-json>
```

客户端已经通过 Tauri Updater 的 `check({ headers })` 和 `downloadAndInstall(..., { headers })` 接入。请求体是桌面客户端本地许可状态的 Base64URL JSON；传输安全由 HTTPS 提供，不再有 `UPDATE_TOKEN_SECRET`。

这里的“客户端”专指安装在用户电脑上的 Rust/Tauri 桌面程序，不是购买网页。购买网页只处理 PayPal 下单和激活码展示；真正请求版本信息、下载更新包的是桌面程序。

### 两种更新授权

- PayPal：桌面程序提交本机已有的激活码和机器码；Worker 只在此分支查询 D1。
- Microsoft Store：桌面程序提交本机 `Windows.Services.Store` 已判断的状态；Worker 不再调用 Microsoft 服务，也不写 D1。
- 这种简化方案接受“客户端可被修改”的风险：修改后的客户端可以伪造 Store 状态。它适合你明确接受的低摩擦付费更新模型，不适合作为强防破解方案。

授权成功不代表 MSIX 可以安装 NSIS。Microsoft Store 安装的 MSIX 若被普通 NSIS/MSI 覆盖，会变成无 Store 包身份的安装，之后 `Windows.Services.Store` 可能无法继续验证订阅。因此当前官网可以统一做“授权与文件分发”，但 release catalog 必须按安装模型提供兼容包：官网普通安装版使用 Tauri NSIS Updater；Store MSIX 继续使用 Store/MSIX servicing，或以后增加同身份 MSIX/App Installer 通路，不能把 MSIX 平台项指向 NSIS 文件。

### 为什么不再使用更新 Token

更新请求直接携带本地许可证明。HTTPS 防止网络窃听和中间人篡改，但不能防止用户修改桌面程序或伪造本地 Store 状态；这是当前方案主动接受的安全边界。

## PayPal 和激活

```text
GET  /api/v1/paypal/config
POST /api/v1/paypal/orders
POST /api/v1/paypal/orders/{order_id}/capture
POST /api/v1/licenses/activate
```

套餐和价格由 Worker 固定定义：

```text
1 month   USD 0.99
3 months  USD 3.99
6 months  USD 6.99
1 year    USD 12.99
Lifetime  USD 19.99
```

浏览器只提交 `plan_id`、订单 ID 和 `SAG-` 机器码；Worker 必须从 PayPal REST API 读取真实状态、币种和金额。

激活码使用现有客户端兼容格式，并通过 `LICENSE_SIGNING_PRIVATE_KEY` 签名。订单和激活码哈希保存到 D1，完整激活码不会明文写入数据库。

### 配置项解释

- 不再需要 `UPDATE_TOKEN_SECRET`、`MICROSOFT_STORE_CLIENT_SECRET`、`MICROSOFT_STORE_TENANT_ID`、`MICROSOFT_STORE_CLIENT_ID`、`MICROSOFT_STORE_ELIGIBLE_PRODUCT_IDS` 或 `SAGRAPH_STORE_PUBLISHER_USER_ID`。
- `LICENSE_SIGNING_PRIVATE_KEY`：Worker 签发激活码的 RSA 私钥。使用仓库外安全保存的 `license-keys/saGraph_license_private.pem`，填写到 Worker Secret。
- `PAYPAL_CLIENT_SECRET`：Worker 调用 PayPal REST API 的服务器密钥，从 PayPal Developer Dashboard 获取，填写到 Worker Secret。
- `TAURI_SIGNING_PRIVATE_KEY`：桌面发布 CI 签署 Tauri 更新包的私钥，从项目 Tauri 签名密钥生成/保存流程获得，填写到桌面仓库 GitHub Actions Secret；它不放 Worker。
