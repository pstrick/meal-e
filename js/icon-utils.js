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
    // Local curated food icon pack
    if (isLocalFoodIcon(value)) {
        const id = value.slice(LOCAL_FOOD_ICON_PREFIX.length);
        const svg = LOCAL_FOOD_ICONS[id];
        if (svg) {
            return `<span class="${className} food-icon" style="width:${size};height:${size};display:inline-flex;align-items:center;justify-content:center;" aria-hidden="true">${svg}</span>`;
        }
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

// Local curated food icon pack (filled / colorful)
// Each icon is referenced by an ID like "food-icon:apple"
const LOCAL_FOOD_ICON_PREFIX = 'food-icon:';

const LOCAL_FOOD_ICONS = {
    // Fruits
    apple: `
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="apple-red" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#ff6b6b"/>
                    <stop offset="100%" stop-color="#e63946"/>
                </linearGradient>
            </defs>
            <path d="M24 6c1.4 0 2.6.7 3.4 1.9.3.5.1 1.2-.4 1.5-.5.3-1.2.1-1.5-.4-.3-.5-.8-.8-1.5-.8-.7 0-1.3.4-1.6 1-.3.6-1 .8-1.6.5-.6-.3-.8-1-.5-1.6C19.3 6.9 20.5 6 22 6h2z" fill="#2f855a"/>
            <path d="M24 10c6.5-2.5 13 1.5 13 9.2C37 32 30 38 24 38S11 32 11 19.2C11 11.5 17.5 7.5 24 10z" fill="url(#apple-red)"/>
            <path d="M18 16c-1.7 0-3 1.3-3 3 0 4.8 2 9 5 11.5 3-2.5 5-6.7 5-11.5 0-1.7-1.3-3-3-3-1.5 0-2.4.8-3 1.6-.6-.8-1.5-1.6-3-1.6z" fill="#ffe5e5" opacity="0.7"/>
        </svg>
    `,
    banana: `
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 34c6 6 16 8 24 2 3.5-2.6 5.8-6.2 7-10.2.3-.9-.1-1.8-1-2.1l-3.3-1.1c-.8-.3-1.6.1-1.9.9-1 2.8-2.6 5.2-4.7 6.8-4.6 3.4-10.6 2.7-14.8-.3-.7-.5-1.7-.5-2.3.2L10 34z" fill="#ffeb3b"/>
            <path d="M36 12c-1.7 0-3 1.3-3 3 0 1.2.7 2.3 1.8 2.8l2.2 1c.7.3 1.5 0 1.9-.7.5-.9.8-1.9.8-3.1 0-1.7-1.3-3-3-3h-.7z" fill="#795548"/>
        </svg>
    `,
    bread: `
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 18c0-5 5-9 14-9s14 4 14 9v16c0 2.2-1.8 4-4 4H14c-2.2 0-4-1.8-4-4V18z" fill="#ffcc80"/>
            <path d="M24 9c7 0 10 3 10 6v2H14v-2c0-3 3-6 10-6z" fill="#ffe0b2"/>
            <circle cx="19" cy="20" r="1" fill="#bf7b3f"/>
            <circle cx="24" cy="22" r="1" fill="#bf7b3f"/>
            <circle cx="29" cy="20" r="1" fill="#bf7b3f"/>
        </svg>
    `,
    meat: `
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 14c6-6 14-7 19-2s4 13-2 19-14 7-19 2-4-13 2-19z" fill="#e57373"/>
            <path d="M18 18c3-3 7-4 9-2s1 6-2 9-7 4-9 2-1-6 2-9z" fill="#ffcccb"/>
            <circle cx="32" cy="12" r="3" fill="#f5f5f5" stroke="#9e9e9e" stroke-width="1.5"/>
        </svg>
    `,
    fish: `
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 24c3-5 8-9 14-9 5.5 0 10 3 13 7-3 4-7.5 7-13 7-6 0-11-4-14-9z" fill="#4fc3f7"/>
            <path d="M15 24c2-3 5-5 9-5 3.8 0 7 2 9 5-2 3-5.2 5-9 5-4 0-7-2-9-5z" fill="#b3e5fc"/>
            <circle cx="20" cy="22" r="1.2" fill="#01579b"/>
            <path d="M9 19l-4-3v16l4-3c1.5-1 1.5-9 0-10z" fill="#81d4fa"/>
        </svg>
    `,
    salad: `
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 20h28l-2 10c-.5 2.5-2.7 4.3-5.3 4.3H17.3c-2.6 0-4.8-1.8-5.3-4.3L10 20z" fill="#c8e6c9"/>
            <path d="M14 18c1.5-3 4.5-5 8-5 2.5 0 4.8 1 6.4 2.8 1-1.7 2.9-2.8 5-2.8 1.8 0 3.4.7 4.6 1.9" fill="none" stroke="#66bb6a" stroke-width="2" stroke-linecap="round"/>
            <circle cx="18" cy="22" r="1.4" fill="#ef5350"/>
            <circle cx="24" cy="24" r="1.4" fill="#ffca28"/>
            <circle cx="30" cy="22" r="1.4" fill="#ab47bc"/>
        </svg>
    `,
    cheese: `
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 26l16-10 16 6v12c0 2.2-1.8 4-4 4H12c-2.2 0-4-1.8-4-4V26z" fill="#ffeb3b"/>
            <path d="M24 16l14 5-6 3-8-3-8 3-6-3 14-5z" fill="#fff59d"/>
            <circle cx="18" cy="28" r="1.5" fill="#fbc02d"/>
            <circle cx="28" cy="30" r="1.7" fill="#fbc02d"/>
            <circle cx="32" cy="26" r="1.3" fill="#fbc02d"/>
        </svg>
    `,
    egg: `
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 10c6 0 11 7 11 14.5S30.6 36 24 36s-11-4.5-11-11.5S18 10 24 10z" fill="#fffde7" stroke="#ffe082" stroke-width="1.5"/>
            <circle cx="24" cy="24" r="5" fill="#ffca28"/>
        </svg>
    `,
    milk: `
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 10h12l2 4v22c0 2.2-1.8 4-4 4H20c-2.2 0-4-1.8-4-4V14l2-4z" fill="#e3f2fd"/>
            <path d="M18 10l2-3h8l2 3H18z" fill="#bbdefb"/>
            <path d="M18 24h12v6c-3 1.5-6 2-12 0v-6z" fill="#fff"/>
        </svg>
    `,
    drink: `
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 14h20l-2 20c-.2 2-1.9 3.5-4 3.5H20c-2.1 0-3.8-1.5-4-3.5L14 14z" fill="#81d4fa"/>
            <path d="M14 18h20l-.5 5c-4 1.5-11 2.5-19 0L14 18z" fill="#4fc3f7"/>
            <path d="M18 10h12" stroke="#90a4ae" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `,
    snack: `
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="14" width="28" height="20" rx="4" fill="#ffccbc"/>
            <path d="M10 18h28" stroke="#ffab91" stroke-width="2"/>
            <circle cx="18" cy="24" r="1.4" fill="#ff7043"/>
            <circle cx="24" cy="26" r="1.4" fill="#ff7043"/>
            <circle cx="30" cy="24" r="1.4" fill="#ff7043"/>
        </svg>
    `
};

function isLocalFoodIcon(value) {
    return typeof value === 'string' && value.startsWith(LOCAL_FOOD_ICON_PREFIX);
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


