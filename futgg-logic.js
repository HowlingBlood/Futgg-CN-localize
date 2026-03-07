// ==UserScript==
// @name         FUT.GG 汉化
// @namespace    https://gitee.com/demk3/futgg-plugin
// @version      0.6
// @description  FUT.GG 汉化插件
// @author       DeluxoMK3
// @updateURL    https://gitee.com/demk3/futgg-plugin/raw/master/futgg-logic.js
// @downloadURL  https://gitee.com/demk3/futgg-plugin/raw/master/futgg-logic.js
// @match        https://www.fut.gg/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
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
        cacheTime: 10800000,
        debug: true
    };

    let i18n = {};
    let regexDict = [];

    async function initDictionary() {
        const now = Date.now();
        const cachedData = GM_getValue("futgg_i18n_cache");
        
        // 1. 检查缓存是否有效
        if (cachedData && (now - cachedData.timestamp < DICT_CONFIG.cacheTime)) {
            i18n = cachedData.data;
            if (DICT_CONFIG.debug) console.log(`[FUT.GG 汉化] 从本地缓存加载字典 (缓存尚余 ${Math.round((DICT_CONFIG.cacheTime - (now - cachedData.timestamp)) / 60000)} 分钟)`);
        } else {
            // 2. 缓存失效或不存在，从网络拉取
            if (DICT_CONFIG.debug) console.log("[FUT.GG 汉化] 正在从网络更新字典...");
            const fetchTasks = DICT_CONFIG.urls.map(url => {
                return new Promise((resolve) => {
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: url + "?t=" + now,
                        timeout: 10000,
                        onload: (res) => {
                            try {
                                const data = JSON.parse(res.responseText);
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
            
            // 3. 存储到本地缓存
            if (Object.keys(i18n).length > 0) {
                GM_setValue("futgg_i18n_cache", {
                    data: i18n,
                    timestamp: now
                });
                if (DICT_CONFIG.debug) console.log("[FUT.GG 汉化] 字典已更新并存入缓存");
            }
        }
        
        // 4. 预编译正则字典
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
                const match = text.match(item.pattern);
                if (match) {
                    let replacement = item.replacement;
                    
                    // 嵌套翻译：尝试翻译捕获组内容
                    // 匹配 $1, $2 等
                    replacement = replacement.replace(/\$(\d+)/g, (m, index) => {
                        const groupValue = match[index];
                        if (groupValue) {
                            const trimmedGroup = groupValue.trim();
                            // 如果捕获组内容在字典中有翻译，则使用翻译，否则保留原样
                            return i18n[trimmedGroup] || groupValue;
                        }
                        return m;
                    });

                    node.textContent = node.textContent.replace(text, replacement);
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
