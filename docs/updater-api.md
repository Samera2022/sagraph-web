# saGraph 官网更新 API 规范

客户端使用 Tauri Updater 2.x。官网负责版本、更新日志和安装包分发，客户端负责签名校验、下载和安装。

## 更新检查

```http
GET /api/v1/updates/{target}/{arch}/{current_version}
```

- `204 No Content`：没有可用更新。
- `200 OK`：返回 Tauri Updater 兼容 JSON。
- `401 Unauthorized`：更新会话无效。
- `403 Forbidden`：许可证不包含该版本或渠道。
- `404 Not Found`：没有对应平台产物。
- `429 Too Many Requests`：请求过于频繁。

```json
{
  "version": "0.2.0",
  "notes": "新增自动更新和更新日志界面。",
  "pub_date": "2026-08-21T12:00:00Z",
  "url": "https://download.example.com/api/v1/releases/0.2.0/windows/x86_64/update.nsis.zip",
  "signature": "BASE64_TAURI_UPDATER_SIGNATURE"
}
```

`version` 必须是语义版本号；`url` 必须使用 HTTPS；`signature` 必须对应下载内容；`pub_date` 使用 ISO 8601 UTC 时间。

## 更新授权

```http
POST /api/v1/update-sessions
Content-Type: application/json
```

```json
{
  "license_token": "...",
  "device_id": "...",
  "current_version": "0.1.0",
  "target": "windows",
  "arch": "x86_64",
  "channel": "stable"
}
```

接口返回有效期 5–30 分钟的短期更新令牌。不要向客户端下发许可证私钥、Updater 私钥或长期 R2 凭据。

## 更新日志

```http
GET /api/v1/changelog/manifest
```

```json
{
  "signed_payload": "{\"sha256\":\"...\",\"document\":{\"versions\":[]}}",
  "signature": "BASE64_CHANGELOG_RSA_SIGNATURE"
}
```

Updater、更新日志和许可证必须分别使用不同私钥。

## 发布一致性

公开版本前必须保证 Git tag、桌面程序版本、更新 API 最新版本和更新日志最新版本一致，并验证所有平台的包、签名、URL、target、arch 和 bundle 类型。
