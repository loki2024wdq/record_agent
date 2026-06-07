# 手机安装 PWA 指南

## 1. 推荐方案：部署到 HTTPS

手机要把这个原型“像 App 一样安装”，最稳妥的方式是把 `app/` 部署到 HTTPS 静态站点。当前项目已经准备好：

- PWA manifest：`app/manifest.webmanifest`
- Service worker：`app/sw.js`
- 手机图标：`app/assets/icon-192.png`、`app/assets/icon-512.png`、`app/assets/icon-maskable-512.png`、`app/assets/apple-touch-icon.png`
- GitHub Pages 自动部署：`.github/workflows/deploy-pages.yml`
- Vercel 配置：`vercel.json`

## 2. 用 GitHub Pages 部署

1. 把当前仓库推送到 GitHub。
2. 在 GitHub 仓库中打开 `Settings`。
3. 进入 `Pages`。
4. 在 `Build and deployment` 中把 `Source` 设为 `GitHub Actions`。
5. 推送到 `main` 分支，或在 `Actions` 页面手动运行 `Deploy PWA to GitHub Pages`。
6. 部署完成后，GitHub 会给出一个 HTTPS 地址。

常见地址格式：

```text
https://你的用户名.github.io/仓库名/
```

## 3. 用 Vercel 部署

1. 登录 Vercel。
2. Import 当前 GitHub 仓库。
3. Framework Preset 选择 `Other`。
4. Build Command 留空。
5. Output Directory 使用 `app`。
6. 部署后打开 Vercel 提供的 HTTPS 地址。

`vercel.json` 已经把输出目录设置成 `app`。

## 4. 在 Android 手机上安装

1. 用 Chrome 打开部署后的 HTTPS 地址。
2. 等页面加载完成。
3. 点击右上角菜单。
4. 选择 `安装应用` 或 `添加到主屏幕`。
5. 安装完成后，桌面会出现“旅行记忆”图标。

## 5. 在 iPhone 上安装

1. 用 Safari 打开部署后的 HTTPS 地址。
2. 点击底部分享按钮。
3. 选择 `添加到主屏幕`。
4. 确认名称为“旅行记忆”。
5. 点击 `添加`。

iOS 会使用 `apple-touch-icon.png` 作为主屏幕图标。

## 6. 局域网临时预览

如果只是想先在手机上看界面，可以让电脑开一个本地服务：

```powershell
python -m http.server 4173 -d app
```

然后在电脑上查局域网 IP：

```powershell
ipconfig
```

手机和电脑连同一个 Wi-Fi 后，手机浏览器打开：

```text
http://你的电脑IP:4173
```

注意：这个方式通常只能预览页面，不一定能正式安装 PWA，因为正式安装更依赖 HTTPS。

## 7. 打包成真正 APK/iOS App 的下一步

等 PWA 在手机上验证顺手后，再进入 Capacitor 路线：

1. 引入 Capacitor。
2. 把 `app/` 作为 Web 输出目录。
3. 接入 Camera、Photos、Geolocation、Filesystem。
4. 生成 Android/iOS 工程。
5. 构建 APK 或提交 TestFlight。

这一步会让相机、相册、位置和本地文件存储变成真正的原生能力。
