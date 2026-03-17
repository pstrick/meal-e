function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end(JSON.stringify(payload));
}

function parseCostcoUrl(rawUrl) {
    try {
        const parsed = new URL(String(rawUrl || '').trim());
        const host = parsed.hostname.toLowerCase();
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return null;
        }
        if (!(host === 'costco.com' || host === 'www.costco.com' || host.endsWith('.costco.com'))) {
            return null;
        }
        return parsed.toString();
    } catch (error) {
        return null;
    }
}

function parseFloatSafe(value) {
    const parsed = Number.parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
}

function parseWeightToGrams(value, rawUnit) {
    const amount = Number.parseFloat(String(value));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const unit = String(rawUnit || '')
        .trim()
        .toLowerCase()
        .replace(/\./g, '')
        .replace(/\s+/g, ' ');
    if (!unit || unit === 'g' || unit === 'gram' || unit === 'grams') return amount;
    if (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms') return amount * 1000;
    if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') return amount * 28.3495;
    if (unit === 'lb' || unit === 'lbs' || unit === 'pound' || unit === 'pounds') return amount * 453.592;
    if (unit === 'ml' || unit === 'milliliter' || unit === 'milliliters' || unit === 'millilitre' || unit === 'millilitres') return amount;
    if (unit === 'l' || unit === 'liter' || unit === 'liters' || unit === 'litre' || unit === 'litres') return amount * 1000;
    if (unit === 'fl oz' || unit === 'floz' || unit === 'fluid ounce' || unit === 'fluid ounces') return amount * 29.5735;
    if (unit === 'cup' || unit === 'cups') return amount * 236.588;
    if (unit === 'tbsp' || unit === 'tablespoon' || unit === 'tablespoons') return amount * 14.7868;
    if (unit === 'tsp' || unit === 'teaspoon' || unit === 'teaspoons') return amount * 4.92892;
    return null;
}

function parseWeightStringToGrams(rawWeightString) {
    const text = String(rawWeightString || '').trim().toLowerCase();
    if (!text) return null;
    const normalizedText = text.replace(/,/g, '').replace(/-/g, ' ');
    const unitPattern = '(fl\\.?\\s*oz|fluid\\s*ounces?|fluid\\s*ounce|kg|kilograms?|g|grams?|oz|ounces?|lb|lbs|pounds?|ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|cups?|tbsp|tablespoons?|tsp|teaspoons?)';

    const multipliedMatch = normalizedText.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*[x×]\\s*(\\d+(?:\\.\\d+)?)\\s*${unitPattern}\\b`, 'i'));
    if (multipliedMatch) {
        const packageCount = Number.parseFloat(multipliedMatch[1]);
        const eachSize = Number.parseFloat(multipliedMatch[2]);
        if (Number.isFinite(packageCount) && Number.isFinite(eachSize)) {
            return parseWeightToGrams(packageCount * eachSize, multipliedMatch[3]);
        }
    }

    const match = normalizedText.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unitPattern}\\b`, 'i'));
    if (!match) return null;
    return parseWeightToGrams(match[1], match[2]);
}

function extractJsonLdBlocks(html) {
    const blocks = [];
    const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match = pattern.exec(html);
    while (match) {
        const raw = String(match[1] || '').trim();
        if (raw) {
            try {
                blocks.push(JSON.parse(raw));
            } catch (error) {
                // Ignore non-JSON or malformed JSON-LD blocks.
            }
        }
        match = pattern.exec(html);
    }
    return blocks;
}

function asArray(value) {
    if (Array.isArray(value)) return value;
    return value == null ? [] : [value];
}

function hasType(node, targetType) {
    const typeField = node?.['@type'];
    const types = asArray(typeField).map(value => String(value || '').toLowerCase());
    return types.includes(String(targetType || '').toLowerCase());
}

function findFirstNodeByType(node, targetType) {
    if (!node || typeof node !== 'object') return null;
    if (hasType(node, targetType)) return node;
    if (Array.isArray(node)) {
        for (const entry of node) {
            const found = findFirstNodeByType(entry, targetType);
            if (found) return found;
        }
        return null;
    }
    for (const key of Object.keys(node)) {
        const found = findFirstNodeByType(node[key], targetType);
        if (found) return found;
    }
    return null;
}

function parseMacroValue(rawValue) {
    return parseFloatSafe(rawValue);
}

function parseServingSizeGramsFromNutrition(nutrition) {
    if (!nutrition || typeof nutrition !== 'object') return null;
    const direct = parseWeightStringToGrams(nutrition.servingSize);
    if (Number.isFinite(direct) && direct > 0) return direct;
    return null;
}

function extractMetaContent(html, propertyName) {
    const escapedName = String(propertyName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'));
    return match ? String(match[1]).trim() : '';
}

function normalizeBreadcrumbName(name) {
    const normalized = String(name || '').trim();
    if (!normalized) return '';
    const lower = normalized.toLowerCase();
    if (lower === 'home' || lower === 'costco' || lower === 'costco grocery' || lower === 'grocery') return '';
    return normalized;
}

function extractStoreSectionFromBreadcrumbs(breadcrumbList) {
    const names = asArray(breadcrumbList?.itemListElement)
        .map(item => {
            if (typeof item?.name === 'string') return item.name;
            if (typeof item?.item?.name === 'string') return item.item.name;
            return '';
        })
        .map(normalizeBreadcrumbName)
        .filter(Boolean);

    if (names.length >= 2) {
        return names[names.length - 2];
    }
    if (names.length === 1) {
        return names[0];
    }
    return '';
}

function buildNormalizedProduct({ productNode, breadcrumbNode, html, sourceUrl }) {
    const nameFromNode = String(productNode?.name || '').trim();
    const nameFromMeta = extractMetaContent(html, 'og:title');
    const name = nameFromNode || nameFromMeta;

    const imageRaw = productNode?.image;
    const imageUrl = Array.isArray(imageRaw)
        ? String(imageRaw[0] || '').trim()
        : String(imageRaw || extractMetaContent(html, 'og:image') || '').trim();

    const offers = productNode?.offers || {};
    const totalPrice = parseFloatSafe(offers?.price ?? offers?.lowPrice ?? offers?.highPrice);

    const nutrition = productNode?.nutrition || {};
    const nutritionData = {
        calories: parseMacroValue(nutrition?.calories),
        fat: parseMacroValue(nutrition?.fatContent),
        carbs: parseMacroValue(nutrition?.carbohydrateContent),
        protein: parseMacroValue(nutrition?.proteinContent)
    };

    const servingSizeGrams = parseServingSizeGramsFromNutrition(nutrition);
    const combinedWeightText = [nameFromNode, productNode?.description, extractMetaContent(html, 'description')].filter(Boolean).join(' ');
    const totalWeightGrams = parseWeightStringToGrams(combinedWeightText);
    const storeSection = extractStoreSectionFromBreadcrumbs(breadcrumbNode);

    return {
        sourceUrl,
        name,
        imageUrl,
        totalPrice,
        totalWeightGrams,
        servingSizeGrams,
        nutrition: nutritionData,
        storeSection
    };
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        return sendJson(res, 200, { success: true });
    }

    if (req.method !== 'GET') {
        return sendJson(res, 405, {
            success: false,
            error: 'Method not allowed. Use GET.'
        });
    }

    const sourceUrl = parseCostcoUrl(req.query?.url);
    if (!sourceUrl) {
        return sendJson(res, 400, {
            success: false,
            error: 'Missing or invalid Costco product URL.'
        });
    }

    try {
        const upstreamResponse = await fetch(sourceUrl, {
            headers: {
                Accept: 'text/html,application/xhtml+xml',
                'User-Agent': 'Mozilla/5.0 (compatible; Meal-E-Costco-Importer/1.0)'
            }
        });

        if (!upstreamResponse.ok) {
            return sendJson(res, upstreamResponse.status, {
                success: false,
                error: 'Costco product request failed.'
            });
        }

        const html = await upstreamResponse.text();
        const jsonLdBlocks = extractJsonLdBlocks(html);
        const productNode = jsonLdBlocks
            .map(block => findFirstNodeByType(block, 'Product'))
            .find(Boolean);
        const breadcrumbNode = jsonLdBlocks
            .map(block => findFirstNodeByType(block, 'BreadcrumbList'))
            .find(Boolean);

        if (!productNode) {
            return sendJson(res, 422, {
                success: false,
                error: 'Unable to parse Costco product details from this URL.'
            });
        }

        const product = buildNormalizedProduct({ productNode, breadcrumbNode, html, sourceUrl });
        if (!product.name) {
            return sendJson(res, 422, {
                success: false,
                error: 'Costco product name is unavailable for this URL.'
            });
        }

        return sendJson(res, 200, {
            success: true,
            product
        });
    } catch (error) {
        return sendJson(res, 500, {
            success: false,
            error: 'Unable to fetch Costco product data.'
        });
    }
};
