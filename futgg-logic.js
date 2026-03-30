// ==UserScript==
// @name         FUT.GG & FUTBIN 汉化
// @namespace    https://gitee.com/demk3/futgg-plugin
// @version      0.8.2
// @description  FUT.GG & FUTBIN 汉化插件
// @author       DeluxoMK3
// @updateURL    https://gitee.com/demk3/futgg-plugin/raw/master/futgg-logic.js
// @downloadURL  https://gitee.com/demk3/futgg-plugin/raw/master/futgg-logic.js
// @match        https://www.fut.gg/*
// @match        https://www.futbin.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      raw.githubusercontent.com
// @connect      gitee.com
// @run-at       document-start
// @license MIT
// ==/UserScript==

(async function() {
    'use strict';
    
    const DICT_CONFIG = {
        urls: [
            "https://gitee.com/demk3/futgg-plugin/raw/master/main.json",
            "https://gitee.com/demk3/futgg-plugin/raw/master/livetracker.json",
            "https://gitee.com/demk3/futgg-plugin/raw/master/league.json",
            "https://raw.githubusercontent.com/HowlingBlood/Futgg-CN-localize/refs/heads/master/club.json",
            "https://gitee.com/demk3/futgg-plugin/raw/master/nation.json",
            "https://gitee.com/demk3/futgg-plugin/raw/master/evolab.json",
            "https://gitee.com/demk3/futgg-plugin/raw/master/ggclub.json",
            "https://gitee.com/demk3/futgg-plugin/raw/master/rarity.json",
            "https://gitee.com/demk3/futgg-plugin/raw/master/futbin.json",
            "https://gitee.com/demk3/futgg-plugin/raw/master/text-evo.json"
        ],
        cacheTime: 3600000,
        debug: true
    };

    let i18n = {};
    let regexDict = [];

    
    async function initDictionary(force = false) {
        const now = Date.now();
        const cachedData = GM_getValue("futgg_i18n_cache");
        
        // 1. 检查缓存是否有效 (除非强制更新)
        if (!force && cachedData && (now - cachedData.timestamp < DICT_CONFIG.cacheTime)) {
            i18n = cachedData.data;
            if (DICT_CONFIG.debug) console.log(`[FUT.GG 汉化] 从本地缓存加载字典 (缓存尚余 ${Math.round((DICT_CONFIG.cacheTime - (now - cachedData.timestamp)) / 60000)} 分钟)`);
        } else {
            // 2. 缓存失效或强制更新，从网络拉取
            if (DICT_CONFIG.debug) console.log(force ? "[FUT.GG 汉化] 正在强制从网络更新字典..." : "[FUT.GG 汉化] 正在从网络更新字典...");
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
    }

    // 创建强制更新按钮
    function createUpdateButton() {
        const btn = document.createElement('div');
        btn.id = 'futgg-update-btn';
        btn.innerHTML = '🔄';
        btn.title = '强制更新汉化字典';
        Object.assign(btn.style, {
            position: 'fixed',
            right: '20px',
            bottom: '80px',
            width: '40px',
            height: '40px',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: '9999',
            boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
            fontSize: '20px',
            transition: 'all 0.3s ease',
            border: '1px solid #333'
        });

        btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
        btn.onmouseout = () => btn.style.transform = 'scale(1)';

        let updating = false;
        btn.onclick = async () => {
            if (updating) return;
            updating = true;
            btn.style.opacity = '0.5';
            btn.innerHTML = '⌛';
            
            try {
                await initDictionary(true);
                translateNode(document.body);
                btn.innerHTML = '✅';
                setTimeout(() => {
                    btn.innerHTML = '🔄';
                    btn.style.opacity = '1';
                    updating = false;
                }, 2000);
            } catch (e) {
                btn.innerHTML = '❌';
                setTimeout(() => {
                    btn.innerHTML = '🔄';
                    btn.style.opacity = '1';
                    updating = false;
                }, 2000);
            }
        };

        // 确保 body 存在后再添加
        if (document.body) {
            document.body.appendChild(btn);
        } else {
            const bodyObserver = new MutationObserver(() => {
                if (document.body) {
                    document.body.appendChild(btn);
                    bodyObserver.disconnect();
                }
            });
            bodyObserver.observe(document.documentElement, { childList: true });
        }
    }

    // 通用翻译函数
    function getTranslation(text) {
        if (!text) return null;
        const trimmed = text.trim();
        if (!trimmed) return null;

        // 1. 精确匹配
        if (i18n[trimmed]) {
            return i18n[trimmed];
        }

        // 2. 正则匹配
        for (const item of regexDict) {
            const match = trimmed.match(item.pattern);
            if (match) {
                let replacement = item.replacement;
                // 嵌套翻译捕获组
                replacement = replacement.replace(/\$(\d+)/g, (m, index) => {
                    const groupValue = match[index];
                    if (groupValue) {
                        const tg = groupValue.trim();
                        return i18n[tg] || groupValue;
                    }
                    return m;
                });
                return replacement;
            }
        }
        return null;
    }

    
    function translateNode(node) {
        if (!node) return;
        if (node.nodeType === Node.TEXT_NODE) {
            const translated = getTranslation(node.textContent);
            if (translated) {
                node.textContent = translated;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // 翻译属性 (placeholder, title)
            if (node.placeholder) {
                const translated = getTranslation(node.placeholder);
                if (translated) node.placeholder = translated;
            }
            if (node.title) {
                const translated = getTranslation(node.title);
                if (translated) node.title = translated;
            }

            const ignoredTags = ['SCRIPT', 'STYLE', 'CODE'];
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
        document.head ? document.head.appendChild(style) : document.documentElement.appendChild(style);
    }

    // 初始化流程
    async function start() {
        injectStyles();
        await initDictionary();
        createUpdateButton();

        const runTranslation = () => {
            if (Object.keys(i18n).length > 0 && document.body) {
                translateNode(document.body);
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                return true;
            }
            return false;
        };

        if (!runTranslation()) {
            const startObserver = new MutationObserver(() => {
                if (runTranslation()) startObserver.disconnect();
            });
            startObserver.observe(document.documentElement, { childList: true });
        }
    }

    start();
})();

