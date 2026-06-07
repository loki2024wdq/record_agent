# App 打包路线

## 1. 推荐路线

当前原型是 PWA 内核，后续可以按目标平台选择打包壳：

| 目标 | 推荐方案 | 适用原因 |
| --- | --- | --- |
| 桌面 App | Tauri | 体积小，系统集成好，适合个人工具 |
| 桌面 App | Electron | 生态成熟，调试容易，包体更大 |
| iOS/Android | Capacitor | 复用 Web/PWA 代码，便于接相机、相册、位置 |
| 纯 Web | PWA | 最快分发，可直接安装到桌面或手机主屏 |

第一阶段建议先保持 PWA，再做 Capacitor 移动端壳。原因是这个产品强依赖拍照、相册、位置和旅途中使用，移动端优先级高。

## 2. 当前可打包状态

已具备：

- `app/index.html`
- `app/manifest.webmanifest`
- `app/sw.js`
- PNG 和 maskable 图标
- GitHub Pages 自动部署配置
- Vercel 静态部署配置
- 本地离线缓存
- 响应式布局
- 本地数据存储

暂缺：

- 原生相机/相册权限桥接
- 原生位置权限桥接
- 后端同步
- 构建脚本和代码签名

## 3. PWA 安装

用本地或线上静态服务托管 `app/` 后，在支持 PWA 的浏览器中访问即可安装。

本地服务示例：

```powershell
python -m http.server 4173 -d app
```

访问：

```text
http://localhost:4173
```

正式安装到手机时，推荐部署到 HTTPS，具体步骤见 `docs/DEPLOY_PWA.md`。

## 4. Capacitor 移动端路线

后续接入步骤：

1. 初始化前端工程，例如 Vite 或保持静态目录。
2. 安装 Capacitor。
3. 设置 `webDir` 指向构建后的 Web 目录。
4. 增加 iOS/Android 平台。
5. 接入 Camera、Filesystem、Geolocation 插件。
6. 将当前文件导入、位置字段和本地存储替换为原生能力。

需要重点处理：

- 大照片不要长期存 `localStorage`，应存文件系统或 IndexedDB。
- 3D 资产需要缓存管理和清理策略。
- 后台生成状态需要通知或前台轮询。

## 5. Tauri/Electron 桌面路线

桌面端适合旅行结束后的整理、编辑和导出：

1. 使用当前 PWA 作为 renderer。
2. 原生层负责文件访问、导出、系统分享和本地模型调用。
3. 3D 查看器继续运行在 WebGL/Canvas 层。
4. 后续可加入本地图片索引和批量导入。

Tauri 更适合轻量个人工具；Electron 更适合需要大量 Node 生态和快速插件集成的团队版本。

## 6. 打包前检查清单

- 用 IndexedDB 或原生文件系统替换大图片的 `localStorage`。
- 增加真实 PNG 图标：192、512、maskable。
- 增加权限说明：相机、相册、位置、麦克风。
- 明确云端处理提示和隐私策略。
- 添加错误状态：照片太大、生成失败、离线同步失败。
- 加入 UI 自动化测试。
- 对导出文件名、分享链接和删除逻辑做安全检查。
