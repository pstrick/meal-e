const WEGMANS_HOST = 'https://www.wegmans.com';

function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end(JSON.stringify(payload));
}

function parseStoreNumber(rawStoreNumber) {
    const parsed = Number.parseInt(String(rawStoreNumber || ''), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return 24;
    }
    return parsed;
}

function parseProductId(rawProductId) {
    const productId = String(rawProductId || '').trim();
    if (!/^\d+$/.test(productId)) {
        return null;
    }
    return productId;
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

    const storeNumber = parseStoreNumber(req.query?.storeNumber);
    const productId = parseProductId(req.query?.productId);
    if (!productId) {
        return sendJson(res, 400, {
            success: false,
            error: 'Missing or invalid productId.'
        });
    }

    const endpoint = `${WEGMANS_HOST}/api/products/${storeNumber}/${productId}`;

    try {
        const upstreamResponse = await fetch(endpoint, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!upstreamResponse.ok) {
            return sendJson(res, upstreamResponse.status, {
                success: false,
                error: 'Wegmans product request failed.'
            });
        }

        const product = await upstreamResponse.json();
        return sendJson(res, 200, {
            success: true,
            product
        });
    } catch (error) {
        return sendJson(res, 500, {
            success: false,
            error: 'Unable to fetch Wegmans product data.'
        });
    }
};
