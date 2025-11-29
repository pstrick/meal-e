const ICONIFY_SCRIPT_URL = 'https://code.iconify.design/3/3.1.0/iconify.min.js';
const ICONIFY_PREFIX = 'iconify:';

let iconifyLoaderPromise = null;

function ensureIconifyScript() {
    if (typeof window === 'undefined') {
        return Promise.resolve(null);
    }

    if (window.Iconify && typeof window.Iconify.scan === 'function') {
        return Promise.resolve(window.Iconify);
    }

    if (iconifyLoaderPromise) {
        return iconifyLoaderPromise;
    }

    iconifyLoaderPromise = new Promise((resolve, reject) => {
        const existingScript = Array.from(document.getElementsByTagName('script')).find((script) => {
            const src = script.getAttribute('src') || '';
            return script.dataset?.iconifyLoader === 'true' || src.includes('/iconify.min.js');
        }) || null;

        const script = existingScript || document.createElement('script');
        script.dataset.iconifyLoader = 'true';

        const cleanup = () => {
            script.removeEventListener('load', handleLoad);
            script.removeEventListener('error', handleError);
        };

        const handleLoad = () => {
            cleanup();
            if (window.Iconify && typeof window.Iconify.scan === 'function') {
                resolve(window.Iconify);
            } else {
                iconifyLoaderPromise = null;
                reject(new Error('Iconify script loaded but Iconify object is unavailable.'));
            }
        };

        const handleError = () => {
            cleanup();
            iconifyLoaderPromise = null;
            reject(new Error('Failed to load Iconify script.'));
        };

        script.addEventListener('load', handleLoad, { once: true });
        script.addEventListener('error', handleError, { once: true });

        if (!existingScript) {
            script.src = ICONIFY_SCRIPT_URL;
            script.async = true;
            document.head.appendChild(script);
        } else if (existingScript.dataset?.iconifyLoaded === 'true' || ['loaded', 'complete'].includes(existingScript.readyState || '')) {
            handleLoad();
            return;
        }
    });

    return iconifyLoaderPromise;
}

export function ensureIconify() {
    return ensureIconifyScript();
}

export function scanIconifyElements(root = document.body) {
    return ensureIconifyScript()
        .then((iconify) => {
            if (iconify && typeof iconify.scan === 'function') {
                iconify.scan(root);
            }
        })
        .catch((error) => {
            console.warn('Iconify scan skipped:', error);
        });
}

export function isIconifyIcon(value) {
    return typeof value === 'string' && value.startsWith(ICONIFY_PREFIX);
}

export function toIconifyName(value) {
    return isIconifyIcon(value) ? value.slice(ICONIFY_PREFIX.length) : value;
}

export function normalizeIconValue(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) {
        return '';
    }
    if (trimmed.startsWith(ICONIFY_PREFIX)) {
        return trimmed;
    }
    const chars = Array.from(trimmed);
    return chars.slice(0, 2).join('');
}

export function renderIcon(value, options = {}) {
    const { className = 'ingredient-icon', fallback = '', size = '24px' } = options;
    if (!value) {
        return fallback;
    }
    // If it's a data URL, render as image
    if (isDataUrl(value)) {
        return `<img src="${value}" class="${className}" style="width: ${size}; height: ${size}; object-fit: contain;" alt="" aria-hidden="true">`;
    }
    // If it's an Iconify icon, render with Iconify
    if (isIconifyIcon(value)) {
        const iconName = toIconifyName(value);
        return `<span class="${className} iconify" data-icon="${iconName}" aria-hidden="true"></span>`;
    }
    // Otherwise, treat as emoji/text
    return `<span class="${className}" aria-hidden="true">${value}</span>`;
}

export function getIconText(value) {
    if (!value) {
        return '';
    }
    if (isIconifyIcon(value)) {
        const iconName = toIconifyName(value);
        const parts = iconName.split(':');
        const namePart = parts.length > 1 ? parts[1] : parts[0];
        return namePart.replace(/[-_]+/g, ' ');
    }
    return value;
}

export function mergeIconLists(...lists) {
    const seen = new Set();
    const result = [];
    lists.forEach((list) => {
        list.forEach((item) => {
            const key = item.code || item.emoji || item.icon || item.value;
            if (!key || seen.has(key)) {
                return;
            }
            seen.add(key);
            result.push(item);
        });
    });
    return result;
}

/**
 * Convert an Iconify icon to an SVG data URL
 * @param {string} iconName - Icon name (e.g., "mdi:food-apple")
 * @returns {Promise<string|null>} Data URL of the SVG icon
 */
export async function iconifyToDataUrl(iconName) {
    if (!iconName || typeof iconName !== 'string') {
        return null;
    }

    // Remove iconify: prefix if present
    const cleanIconName = iconName.startsWith(ICONIFY_PREFIX) 
        ? iconName.slice(ICONIFY_PREFIX.length) 
        : iconName;

    try {
        // Fetch SVG directly from Iconify API
        const [collection, icon] = cleanIconName.split(':');
        if (!collection || !icon) {
            throw new Error(`Invalid icon name format: ${cleanIconName}`);
        }
        
        const apiUrl = `https://api.iconify.design/${collection}/${icon}.svg`;
        console.log('Fetching icon from:', apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch icon: ${response.status} ${response.statusText}`);
        }
        
        const svgText = await response.text();
        if (!svgText || !svgText.trim()) {
            throw new Error('Empty SVG response');
        }
        
        // Convert SVG to data URL
        const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result;
                console.log('Icon converted to data URL, length:', dataUrl.length);
                resolve(dataUrl);
            };
            reader.onerror = () => reject(new Error('Failed to read SVG blob'));
            reader.readAsDataURL(svgBlob);
        });
    } catch (error) {
        console.error('Error converting icon to data URL:', error);
        return null;
    }
}

/**
 * Check if a value is a data URL (image)
 * @param {string} value - Value to check
 * @returns {boolean}
 */
export function isDataUrl(value) {
    return typeof value === 'string' && value.startsWith('data:image/');
}

/**
 * Render icon as image if it's a data URL, otherwise use Iconify
 * @param {string} value - Icon value (data URL, iconify: reference, or emoji)
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
export function renderIconAsImage(value, options = {}) {
    const { className = 'ingredient-icon', fallback = '', size = '24px' } = options;
    if (!value) {
        return fallback;
    }
    
    // If it's a data URL, render as <img>
    if (isDataUrl(value)) {
        return `<img src="${value}" class="${className}" style="width: ${size}; height: ${size}; object-fit: contain;" alt="" aria-hidden="true">`;
    }
    
    // Otherwise use the existing renderIcon function
    return renderIcon(value, options);
}


