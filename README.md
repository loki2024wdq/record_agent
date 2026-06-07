# 旅行意义记录 Agent

这是一个面向旅行记忆记录的 App 原型。它根据 `docs/PRD.md` 的 MVP 范围，先实现本地可运行的 PWA：创建旅行、记录照片和说明、Agent 补全摘要与问题、生成 2.5D 记忆对象、添加标注、查看时间线/地图/3D 记忆库，并导出记忆卡片。

## 当前形态

- 无依赖纯前端：`app/index.html`、`app/styles.css`、`app/main.js`
- 本地存储：使用浏览器 `localStorage` 保存旅行、照片压缩图、说明、标签和 2.5D 状态
- PWA 准备：包含 `manifest.webmanifest`、`sw.js`、移动端图标和部署配置
- 可打包路径：后续可接 Electron、Tauri 或 Capacitor

## 本地运行

可以直接双击或在浏览器中打开：

```text
app/index.html
```

更推荐用本地静态服务运行，这样 PWA 能注册 service worker：

```powershell
python -m http.server 4173 -d app
```

然后访问：

```text
http://localhost:4173
```

如果系统没有 Python，可使用 Codex 工作区运行时中的 Python，路径见当前环境的 workspace dependencies。

项目也预留了脚本入口：

```powershell
npm run serve
npm run verify
```

当前环境没有可用 npm，这些脚本主要给后续标准 Node 开发环境使用。

## 安装到手机

推荐先把 `app/` 部署到 HTTPS 静态站点，然后在手机浏览器里添加到主屏幕。

已准备好的部署方式：

- GitHub Pages：`.github/workflows/deploy-pages.yml`
- Vercel：`vercel.json`

详细步骤见：

[docs/DEPLOY_PWA.md](docs/DEPLOY_PWA.md)

## 下一步

1. 接入真实视觉理解和语音转文字服务。
2. 把当前 2.5D 任务接口替换为真实 3D 重建管线。
3. 引入后端存储、账户、权限和分享链接。
4. 选择 Electron/Tauri/Capacitor 之一进行 App 打包。
