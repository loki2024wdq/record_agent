# 技术设计草案

## 1. 当前实现定位

当前仓库先实现一个无依赖 PWA 原型，目标是验证 PRD 中的核心产品闭环：

1. 用户创建或选择旅行。
2. 用户导入照片并补充说明。
3. Agent 生成标题、摘要、标签和追问。
4. 用户从照片生成 L1 单图 2.5D 记忆对象。
5. 用户添加说明点、查看时间线、地图、3D 记忆库和旅行回顾。
6. 用户导出单条记忆卡片。

当前版本不接云端，不上传照片，不做真实 3D 重建。所有数据保存在浏览器 `localStorage` 中，适合作为交互原型和后续工程拆分基线。

## 2. 目录结构

```text
record_agent/
  app/
    index.html              # PWA 原型入口
    styles.css              # 应用样式
    main.js                 # 本地状态、交互、2.5D 模拟、导出逻辑
    manifest.webmanifest    # PWA manifest
    sw.js                   # 简单离线缓存
    assets/
      icon.svg              # App 图标
  docs/
    PRD.md                  # 产品需求文档
    TECHNICAL_DESIGN.md     # 技术设计草案
    PACKAGING.md            # 打包路线
```

## 3. 前端模块

### 3.1 App Shell

- 左侧：旅行列表、创建旅行、隐私提示。
- 中间：今日记录、Agent 提示、时间线/地图/3D 记忆库/旅行回顾。
- 右侧：记忆详情、2.5D 查看器、标注、导出。

### 3.2 本地数据层

当前使用 `localStorage` 保存一个完整状态对象：

- `trips`：旅行项目。
- `memories`：意义记忆。
- `media`：压缩后的图片 data URL。
- `objects3D`：2.5D/3D 生成任务与结果状态。
- `activeTripId`：当前旅行。
- `selectedMemoryId`：当前选中记忆。

后续可替换为 IndexedDB，并在接入后端后增加同步队列。

### 3.3 Agent 层

当前 `buildAgentDraft` 是本地规则模拟：

- 根据标题、说明、地点和标签推断摘要。
- 用关键词生成标签。
- 固定生成 3 个意义补全问题。

后续应替换为多模态 Agent 服务：

- 图片理解：主体、场景、OCR、地标线索。
- 语音转文字：旅途中快速口述。
- 文本整理：标题、摘要、标签、情绪。
- 对话追问：根据用户风格和旅行上下文动态生成问题。

### 3.4 3D 生成层

当前 `start3DGeneration` 模拟 L1 单图 2.5D：

- 创建 `Object3D` 任务。
- 用进度条模拟异步生成。
- 完成后用 CSS perspective 和多层图片创建深度视差。
- 标注点保存在 `Memory.annotations`。

后续真实管线建议保持同样的任务模型：

```text
queued -> processing -> succeeded | failed
```

返回资产可以是：

- L1：深度图 + 原图 + 前景 mask。
- L2：主体 mesh 或 neural render。
- L3：多图/视频 Gaussian Splatting、mesh、point cloud。
- L4：轻量场景资产和漫游入口。

## 4. 后端演进方案

### 4.1 MVP 后端服务

- Auth Service：用户、登录、设备会话。
- Trip Service：旅行、记忆、标签、情绪、隐私。
- Media Service：上传、EXIF、缩略图、转码、对象存储。
- Agent Service：视觉理解、语音转文字、摘要、追问。
- 3D Job Service：任务队列、状态、失败重试、资产地址。
- Export Service：图片卡片、Markdown、PDF、网页展览。

### 4.2 推荐接口边界

```http
POST /trips
GET /trips
POST /trips/:tripId/memories
PATCH /memories/:memoryId
POST /media
POST /agent/memory-draft
POST /objects3d/jobs
GET /objects3d/jobs/:jobId
POST /exports/cards
```

### 4.3 数据存储

- PostgreSQL：Trip、Memory、Annotation、Job、Permission。
- Object Storage：原图、缩略图、音频、3D 资产。
- Vector Store：记忆摘要、图片描述、地点和标签，用于语义搜索。
- Queue：3D 生成、语音转文字、导出任务。

## 5. 隐私设计

- 默认 `privacyLevel = private`。
- 分享前检测精确位置、人脸、车牌、证件和住址。
- 用户原话和 Agent 改写内容分开保存。
- 删除旅行时同步删除媒体和 3D 资产。
- 真实 3D 生成若上传云端，需要在任务创建前给出明确提示。

## 6. 后续工程任务

1. 把 `localStorage` 迁移到 IndexedDB，支持更大的照片数据。
2. 增加语音输入和转写结果编辑。
3. 抽离 `AgentProvider` 和 `Object3DProvider` 接口。
4. 引入真实地图组件。
5. 增加单元测试和端到端 UI 测试。
6. 选择 App 打包方案并建立 CI 构建。
