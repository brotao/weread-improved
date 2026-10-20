# 微信读书 · 一键全屏阅读

`weread-fullscreen.user.js` 是一个 Tampermonkey / Violentmonkey 油猴脚本，作用域为 `https://weread.qq.com/web/reader/*`。

## 功能

- 在阅读页顶栏最右侧（头像/登录入口之后）增加「全屏」按钮。
- 点击后：
  - 书页/正文区域撑满屏幕宽度，左右各留 `64px`～`96px`（随视口宽度变化）。
  - 右下角控制栏吸附到右侧预留边距内，不遮挡正文。
  - 控制栏的 tooltip 改为向左弹出，避免超出屏幕。
  - 同时适配「滚动阅读」和「横向翻页」两种布局。
- 再次点击「退出全屏」恢复微信读书原始布局。
- 自动记忆开关状态，刷新后保持。
- 快捷键：`Alt + Shift + F`。
- 适配浅色 / 深色主题。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey。
2. 新建用户脚本，把 `weread-fullscreen.user.js` 的内容粘贴进去并保存。
3. 打开微信读书阅读页（`weread.qq.com/web/reader/...`），刷新页面。

## 调整边距

脚本里的这一行控制左右留白：

```js
const GUTTER = 'clamp(64px, 4vw, 96px)';
```

控制栏本身宽 `48px`，右边距 `8px`，所以最小留白取 `64px` 时，正文与控制栏之间还能留出 `8px` 间距。想要更宽松可以改成 `80px` 或 `96px`。

## 实现原理

微信读书网页版的正文是绘制在 canvas 上的，单纯改 CSS 宽度不会让正文自动重排。脚本做了三件事：

1. 给 `body` 加 `wrfs-enabled` 类，通过 CSS 覆盖：
   - `.readerContent .app_content` 的 `max-width`
   - `.readerTopBar` 的宽度
   - `.readerChapterContent` 的宽度和左右 margin
   - `.readerControls` 的位置
2. 改完宽度后派发 `resize` / `orientationchange` 事件，触发微信读书按新宽度重新计算并重绘 canvas。
3. 针对两种阅读布局分别定位控制栏：
   - 滚动模式：`.readerControls` 是 `position: fixed`，直接 `right: 8px`。
   - 横向翻页模式：`.readerControls` 是相对书页的 `position: absolute`，使用 `right: calc(8px - var(--wrfs-gutter))` 把它放到书页右侧的留白里。

## 说明与限制

- 这个脚本面向**在线版微信读书**。你保存下来的 HTML 是没有 JS 的静态快照，正文已经画进 canvas；在本地打开时脚本只能让页面变宽，正文 canvas 不会重新排版。建议在 `weread.qq.com` 上使用。
- 移动端（宽度 ≤ 767px）微信读书会隐藏顶栏和控制栏，脚本主要针对桌面端。
- 如果微信读书后续大改 DOM class，可能需要同步更新选择器。
