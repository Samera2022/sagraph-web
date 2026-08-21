# Cloudflare 已配置值

```text
Pages project: sagraph-web
Pages source directory: sagraph-web
Website: https://www.sagraph.top

Worker project: sagraph-api
Worker source directory: sagraph-api
API: https://api.sagraph.top
Download: https://download.sagraph.top

R2 bucket: sagraph-releases
R2 binding: RELEASES_BUCKET
```

只记录 Secret 是否建立，不记录 Secret 值：

```text
[ ] TAURI_SIGNING_PRIVATE_KEY 已存入发布 CI
[ ] TAURI_SIGNING_PRIVATE_KEY_PASSWORD 已存入发布 CI
[ ] CHANGELOG_SIGNING_PRIVATE_KEY 已存入发布 CI
[ ] UPDATE_TOKEN_SECRET 已在需要时加入 Worker
[ ] updater 私钥离线备份已验证
```

客户端最终地址：

```text
https://api.sagraph.top/api/v1/updates/{{target}}/{{arch}}/{{current_version}}
https://api.sagraph.top/api/v1/changelog/manifest
```
