// ==UserScript==
// @name         微信读书 · 一键全屏阅读
// @namespace    https://weread.qq.com/
// @version      1.0.0
// @description  在微信读书网页版右上角添加「全屏」按钮：正文宽度铺满屏幕，并为右下角控制栏预留边距。
// @author       weread-improved
// @match        https://weread.qq.com/web/reader/*
// @icon         https://weread.qq.com/favicon.ico
// @run-at       document-idle
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'wrfs-enabled-v1';
    const GUTTER = 'clamp(64px, 4vw, 96px)';
    const CONTROLS_RIGHT = '8px';
    const LABEL_ON = '退出全屏';
    const LABEL_OFF = '全屏';

    const ICON_EXPAND = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M20 9V5.5A1.5 1.5 0 0 0 18.5 4H15M4 15v3.5A1.5 1.5 0 0 0 5.5 20H9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15"
                fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`;
    const ICON_COLLAPSE = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4M15 4v3.5A1.5 1.5 0 0 0 16.5 9H20M9 20v-3.5A1.5 1.5 0 0 0 7.5 15H4M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20"
                fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`;

    let enabled = readEnabled();
    let reflowTimers = [];
    let mountTimer = 0;
    let contentSeen = false;

    /* ------------------------------------------------------------------ */
    /* 样式                                                                */
    /* ------------------------------------------------------------------ */

    function installStyles() {
        if (document.getElementById('wrfs-style')) return;

        const style = document.createElement('style');
        style.id = 'wrfs-style';
        style.textContent = `
            /* 顶部栏里的切换按钮 */
            #wrfs-toggle {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                height: 32px;
                margin-left: 14px;
                padding: 0 8px;
                border: 0;
                border-radius: 16px;
                background: transparent;
                color: #717882;
                font: inherit;
                font-size: 14px;
                font-weight: 500;
                line-height: 20px;
                white-space: nowrap;
                cursor: pointer;
                transition: color .15s ease, background-color .15s ease;
            }
            #wrfs-toggle svg {
                display: block;
                width: 18px;
                height: 18px;
                flex: 0 0 18px;
            }
            #wrfs-toggle:hover {
                color: #212832;
                background: rgba(0, 0, 0, .045);
            }
            body:not(.wr_whiteTheme) #wrfs-toggle:hover {
                color: #eef0f4;
                background: rgba(255, 255, 255, .07);
            }
            #wrfs-toggle[aria-pressed="true"] {
                color: #1b88ee;
            }
            body:not(.wr_whiteTheme) #wrfs-toggle[aria-pressed="true"] {
                color: #6cb6ff;
            }

            /* 全屏模式：书页铺满视口 */
            body.wrfs-enabled {
                --wrfs-gutter: ${GUTTER};
            }
            body.wrfs-enabled .readerContent .app_content {
                max-width: 100% !important;
            }
            body.wrfs-enabled .readerTopBar {
                width: 100% !important;
                max-width: 100% !important;
            }

            /* 横向翻页模式：顶栏原本是 80% 宽并居中 */
            body.wrfs-enabled .wr_horizontalReader .readerTopBar {
                left: 0 !important;
                transform: none !important;
                padding: 0 24px !important;
            }

            /* 正文两侧只留出控制栏需要的宽度 */
            body.wrfs-enabled .readerChapterContent {
                box-sizing: border-box !important;
                width: calc(100% - 2 * var(--wrfs-gutter)) !important;
                max-width: 100% !important;
                margin-left: var(--wrfs-gutter) !important;
                margin-right: var(--wrfs-gutter) !important;
            }
            body.wrfs-enabled .readerContentHeader {
                margin-left: var(--wrfs-gutter) !important;
                margin-right: var(--wrfs-gutter) !important;
            }
            body.wrfs-enabled .readerFooter {
                padding-left: var(--wrfs-gutter) !important;
                padding-right: var(--wrfs-gutter) !important;
            }
            body.wrfs-enabled .readerContent .readerMemberCardTipsNew {
                max-width: 100% !important;
                padding-left: var(--wrfs-gutter) !important;
                padding-right: var(--wrfs-gutter) !important;
            }

            /* 滚动模式右下角控制栏：固定到预留的右侧边距里 */
            body.wrfs-enabled .readerControls {
                left: auto !important;
                right: ${CONTROLS_RIGHT} !important;
                margin-left: 0 !important;
            }
            /* 横向翻页模式控制栏原本相对书页绝对定位，计算到书页右侧的留白里 */
            body.wrfs-enabled .wr_horizontalReader .readerControls {
                left: auto !important;
                right: calc(${CONTROLS_RIGHT} - var(--wrfs-gutter)) !important;
                margin-left: 0 !important;
            }
            /* 控制栏贴到右边后，tooltip 改为向左弹出，避免超出屏幕 */
            body.wrfs-enabled .readerControls .wr_tooltip_item--right {
                left: auto !important;
                right: calc(100% + var(--offset, 6px)) !important;
                text-align: right;
            }
        `;
        document.head.appendChild(style);
    }

    /* ------------------------------------------------------------------ */
    /* 全屏状态                                                            */
    /* ------------------------------------------------------------------ */

    function readEnabled() {
        try {
            return localStorage.getItem(STORAGE_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function saveEnabled(value) {
        try {
            localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
        } catch (e) {
            /* localStorage 不可用时只保留当前会话状态 */
        }
    }

    function requestReflow() {
        reflowTimers.forEach((timer) => clearTimeout(timer));
        reflowTimers = [];

        const fire = () => {
            try {
                window.dispatchEvent(new Event('resize'));
            } catch (e) {
                /* ignore */
            }
            try {
                window.dispatchEvent(new Event('orientationchange'));
            } catch (e) {
                /* ignore */
            }
        };

        // 立刻触发一次；再等容器完成布局后补一次，确保 canvas 按新宽度重排。
        fire();
        reflowTimers.push(setTimeout(fire, 200));
        reflowTimers.push(setTimeout(fire, 600));
    }

    function setEnabled(next, options) {
        const opts = options || {};
        enabled = Boolean(next);

        if (document.body) {
            document.body.classList.toggle('wrfs-enabled', enabled);
        }
        saveEnabled(enabled);
        updateButton();

        if (opts.reflow !== false) {
            requestReflow();
        }
    }

    function toggle() {
        setEnabled(!enabled);
    }

    /* ------------------------------------------------------------------ */
    /* 顶部栏按钮                                                          */
    /* ------------------------------------------------------------------ */

    function mountButton() {
        const right = document.querySelector('.readerTopBar_right');
        if (!right) return;

        let button = document.getElementById('wrfs-toggle');
        if (button && button.parentElement === right) {
            updateButton();
            return;
        }

        // 阅读器重渲染后旧按钮可能被移除，重新挂载。
        if (!button) {
            button = document.createElement('button');
            button.id = 'wrfs-toggle';
            button.type = 'button';
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                toggle();
            });
        }

        // 放在头像右侧，也就是界面最右上角。
        right.appendChild(button);
        updateButton();
    }

    function updateButton() {
        const button = document.getElementById('wrfs-toggle');
        if (!button) return;

        const state = String(enabled);
        if (button.dataset.wrfsState === state) return;
        button.dataset.wrfsState = state;

        button.setAttribute('aria-pressed', state);
        button.title = enabled ? '退出全屏阅读（Alt+Shift+F）' : '全屏阅读（Alt+Shift+F）';
        button.innerHTML = `${enabled ? ICON_COLLAPSE : ICON_EXPAND}<span>${enabled ? LABEL_ON : LABEL_OFF}</span>`;
    }

    /* ------------------------------------------------------------------ */
    /* 启动 / 监听                                                         */
    /* ------------------------------------------------------------------ */

    function ensureUI() {
        if (!document.body) return;

        installStyles();
        mountButton();

        // 首次看到正文容器时，补一次重排，处理刷新后自动恢复全屏的情况。
        if (!contentSeen && document.querySelector('.readerChapterContent')) {
            contentSeen = true;
            if (enabled) requestReflow();
        }
    }

    function scheduleEnsureUI() {
        if (mountTimer) return;
        mountTimer = setTimeout(() => {
            mountTimer = 0;
            ensureUI();
        }, 120);
    }

    function onKeydown(event) {
        if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
        if (event.code !== 'KeyF') return;

        const target = event.target;
        if (target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        )) {
            return;
        }

        event.preventDefault();
        toggle();
    }

    function boot() {
        installStyles();
        if (document.body) {
            document.body.classList.toggle('wrfs-enabled', enabled);
        }

        ensureUI();

        window.addEventListener('keydown', onKeydown, true);

        // 阅读器是 SPA，章节切换、顶栏重渲染后按钮可能被移除。
        const observer = new MutationObserver(scheduleEnsureUI);
        observer.observe(document.documentElement, { childList: true, subtree: true });

        // MutationObserver 的兜底，确保动态挂载的顶栏也能被捕获。
        setInterval(ensureUI, 2000);

        // 刷新时等阅读器把正文渲染出来后再应用一次宽度。
        if (enabled) {
            window.addEventListener('load', () => requestReflow(), { once: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
}());
