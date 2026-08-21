# Cloudflare 部署值记录模板

复制本文到仓库外的安全位置填写。不要在此文件或 Git 仓库中填写私钥、密码、API token、Account ID 等敏感值。

## 公共信息

```text
根域名:
Pages 项目名: sagraph-web
Pages 生产分支:
官网 URL: https://www.
API URL: https://api.
下载 URL: https://download.
Worker 项目名: sagraph-api
R2 bucket: sagraph-releases
发行渠道: stable
```

## Cloudflare 资源标识

以下信息不应放入前端构建变量；仅记录在团队密码管理器或部署系统中。

```text
Cloudflare Account ID:
Secrets Store ID:
R2 API token 名称:
R2 Access Key ID: <不要填入仓库>
R2 Secret Access Key: <不要填入仓库>
```

## Secret 建立状态

只记录是否完成，不记录值。

```text
[ ] CHANGELOG_SIGNING_PRIVATE_KEY
[ ] LICENSE_SIGNING_PRIVATE_KEY
[ ] UPDATE_TOKEN_SECRET
[ ] ADMIN_SESSION_SECRET
[ ] DATABASE_URL 或 D1 binding
[ ] TAURI_SIGNING_PRIVATE_KEY 已存入发布 CI
[ ] TAURI_SIGNING_PRIVATE_KEY_PASSWORD 已存入发布 CI
[ ] updater 私钥离线备份已验证
```

## Worker Bindings

```text
RELEASES_BUCKET -> sagraph-releases
CHANGELOG_SIGNING_PRIVATE_KEY -> Secrets Store 同名 secret
LICENSE_SIGNING_PRIVATE_KEY -> Secrets Store 同名 secret
UPDATE_TOKEN_SECRET -> Secrets Store 同名 secret
ADMIN_SESSION_SECRET -> Secrets Store 同名 secret
DATABASE_URL -> Secrets Store 同名 secret，或改用 D1 binding
```

## 客户端最终替换项

```text
src-tauri/tauri.conf.json updater endpoint:
https://api.<你的域名>/api/v1/updates/{{target}}/{{arch}}/{{current_version}}

VITE_CHANGELOG_MANIFEST_URL:
https://api.<你的域名>/api/v1/changelog/manifest
```
