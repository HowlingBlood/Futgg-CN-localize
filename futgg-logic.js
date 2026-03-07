// ==UserScript==
// @name         FUT.GG 汉化
// @namespace    https://gitee.com/demk3/futgg-plugin
// @version      0.7
// @description  FUT.GG
// @author       DeluxoMK3
// @match        https://www.fut.gg/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      gitee.com
// @run-at       document-start
// ==/UserScript==

(async function() {
    'use strict';

    
    const DICT_CONFIG = {
        urls: [
            "https://gitee.com/demk3/futgg-plugin/raw/master/main.json",
            "https://gitee.com/demk3/futgg-plugin/raw/master/livetracker.json",
            "https://gitee.com/demk3/futgg-plugin/raw/master/evolab.json"
        ],
        debug: true
    };

    let i18n = {};
    let regexDict = [];

    
    async function initDictionary() {
        const fetchTasks = DICT_CONFIG.urls.map(url => {
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url + "?t=" + new Date().getTime(),
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
        
        // 预编译正则字典
        regexDict = [];
        for (const key in i18n) {
            if (key.startsWith('^') && key.endsWith('$')) {
                try {
                    regexDict.push({
                        pattern: new RegExp(key),
                        replacement: i18n[key]
                    });
                } catch (e) {
                    console.error(`[FUT.GG 汉化] 无效的正则表达式: ${key}`, e);
                }
            }
        }
        
        if (DICT_CONFIG.debug) console.log(`[FUT.GG 汉化] 字典初始化完成，总词条数: ${Object.keys(i18n).length}, 正则条数: ${regexDict.length}`);
    }

    
    function translateNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (!text) return;

            // 1. 精确匹配
            if (i18n[text]) {
                node.textContent = node.textContent.replace(text, i18n[text]);
                return;
            }

            // 2. 正则匹配
            for (const item of regexDict) {
                if (item.pattern.test(text)) {
                    node.textContent = node.textContent.replace(text, text.replace(item.pattern, item.replacement));
                    return;
                }
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            
            const ignoredTags = ['SCRIPT', 'STYLE', 'CODE', 'INPUT', 'TEXTAREA'];
            if (!ignoredTags.includes(node.tagName)) {
                node.childNodes.forEach(translateNode);
            }
        }
    }

    const observer = new MutationObserver((mutations) => {
        if (Object.keys(i18n).length === 0) return;
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                translateNode(node);
            });
        });
    });

    function injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            body, button, input, select, textarea {
                font-family: "Red Hat Display", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif !important;
            }
        `;
        document.head.appendChild(style);
    }

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

    await initDictionary();

    if (Object.keys(i18n).length > 0) {
        translateNode(document.body);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
})();
