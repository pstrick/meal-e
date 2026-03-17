const SETTINGS_KEY = 'meale-settings';

const DEFAULT_STORE_SECTIONS = [
    'Bakery',
    'Dairy',
    'Deli',
    'Frozen',
    'Meat',
    'Pantry',
    'Produce',
    'Seafood'
];

function normalizeStoreSectionName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function sanitizeStoreSections(rawSections) {
    if (!Array.isArray(rawSections)) return [];

    const seen = new Set();
    const sanitized = [];

    rawSections.forEach(section => {
        const normalized = normalizeStoreSectionName(section);
        if (!normalized) return;

        const key = normalized.toLowerCase();
        if (seen.has(key)) return;

        seen.add(key);
        sanitized.push(normalized);
    });

    return sanitized.sort((a, b) => a.localeCompare(b));
}

function parseSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.warn('Unable to parse saved settings while reading store sections:', error);
        return {};
    }
}

function loadStoreSectionsFromSettings() {
    const settings = parseSettings();
    const savedSections = sanitizeStoreSections(settings.storeSections);
    if (savedSections.length > 0) {
        return savedSections;
    }
    return [...DEFAULT_STORE_SECTIONS];
}

function saveStoreSectionsToSettings(storeSections) {
    const settings = parseSettings();
    const normalizedSections = sanitizeStoreSections(storeSections);
    settings.storeSections = normalizedSections;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return normalizedSections;
}

export {
    DEFAULT_STORE_SECTIONS,
    normalizeStoreSectionName,
    sanitizeStoreSections,
    loadStoreSectionsFromSettings,
    saveStoreSectionsToSettings
};
