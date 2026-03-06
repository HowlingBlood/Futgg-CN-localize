// ==UserScript==
// @name         FUT.GG 汉化 (远程字典版)
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  从远程 JSON 字典加载汉化内容并实时翻译 FUT.GG
// @author       DeluxoMK3
// @match        https://www.fut.gg/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      gitee.com
// @run-at       document-start
// ==/UserScript==

(async function() {
    'use strict';

    /**
     * --- 配置区域 ---
     * 请在此处填写你的远程 JSON 字典地址。支持多个字典，会自动合并。
     * 注意：GitHub 请使用 raw 链接；Gitee 同理。
     */
    const DICT_CONFIG = {
        urls: [
            "https://gitee.com/demk3/futgg-plugin/raw/master/futgg-i18n.json",
            "https://gitee.com/demk3/futgg-plugin/raw/master/main.json",
            "https://gitee.com/demk3/futgg-plugin/raw/master/fantastyfc.json",
            "https://gitee.com/demk3/futgg-plugin/raw/master/evolab.json"
        ],
        // 是否开启控制台日志输出
        debug: true
    };

    let i18n = {};

    /**
     * 核心加载函数：异步获取所有远程字典并合并
     */
    async function initDictionary() {
        const fetchTasks = DICT_CONFIG.urls.map(url => {
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url + "?t=" + new Date().getTime(), // 强制跳过缓存
                    timeout: 10000,
                    onload: (res) => {
                        try {
                            const data = JSON.parse(res.responseText);
                            if (DICT_CONFIG.debug) console.log(`[FUT.GG 汉化] 成功加载字典: ${url}`);
                            resolve(data);
                        } catch (e) {
                            console.error(`[FUT.GG 汉化] 字典格式错误 (${url}):`, e);
                            resolve({});
                        }
                    },
                    onerror: (err) => {
                        console.error(`[FUT.GG 汉化] 字典请求失败 (${url}):`, err);
                        resolve({});
                    }
                });
            });
        });

        const results = await Promise.all(fetchTasks);
        i18n = Object.assign({}, ...results);
        if (DICT_CONFIG.debug) console.log(`[FUT.GG 汉化] 字典初始化完成，总词条数: ${Object.keys(i18n).length}`);
    }

    /**
     * 翻译节点函数
     */
    function translateNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text && i18n[text]) {
                node.textContent = i18n[text];
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // 排除交互干扰标签
            const ignoredTags = ['SCRIPT', 'STYLE', 'CODE', 'INPUT', 'TEXTAREA'];
            if (!ignoredTags.includes(node.tagName)) {
                node.childNodes.forEach(translateNode);
            }
        }
    }

    /**
     * DOM 监听器：处理单页应用(SPA)的动态加载内容
     */
    const observer = new MutationObserver((mutations) => {
        if (Object.keys(i18n).length === 0) return;
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                translateNode(node);
            });
        });
    });

    /**
     * 字体优化注入
     */
    function injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            body, button, input, select, textarea {
                font-family: "Red Hat Display", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif !important;
            }
        `;
        document.head.appendChild(style);
    }

    // --- 执行流程 ---

    // 1. 立即注入样式，防止汉化后字体突变
    if (document.head) {
        injectStyles();
    } else {
        const headObserver = new MutationObserver(() => {
            if (document.head) {
                injectStyles();
                headObserver.disconnect();
            }
        });
        headObserver.observe(document.documentElement, { childList: true });
    }

    // 2. 加载数据并启动翻译
    await initDictionary();

    if (Object.keys(i18n).length > 0) {
        // 初次全量翻译
        translateNode(document.body);
        // 开启监听
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
})();
