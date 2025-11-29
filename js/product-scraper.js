// Product Scraper Service
// Scrapes product information from retail websites like Wegmans

/**
 * List of domains that are known to block CORS requests
 * For these domains, we skip direct fetch and go straight to proxy
 */
const CORS_BLOCKED_DOMAINS = [
    'wegmans.com',
    'target.com',
    'walmart.com',
    'kroger.com',
    'safeway.com'
];

/**
 * Check if a URL is from a domain that blocks CORS
 * @param {string} url - URL to check
 * @returns {boolean} True if domain is known to block CORS
 */
function isCorsBlockedDomain(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        return CORS_BLOCKED_DOMAINS.some(domain => hostname.includes(domain));
    } catch (e) {
        return false;
    }
}

/**
 * Fetch HTML from a URL using CORS proxy if needed
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} HTML content
 */
async function fetchWithCorsProxy(url) {
    const skipDirectFetch = isCorsBlockedDomain(url);
    
    // Try direct fetch first only for sites that might allow CORS
    if (!skipDirectFetch) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
                mode: 'cors'
            });
            
            if (response.ok) {
                const text = await response.text();
                if (text && text.length > 100) { // Basic validation that we got HTML
                    return text;
                }
            }
        } catch (error) {
            console.log('Direct fetch failed (expected for CORS-blocked sites), using CORS proxy:', error.message);
        }
    } else {
        console.log('Skipping direct fetch for CORS-blocked domain, using proxy');
    }
    
    // Use CORS proxy - try multiple proxies in order
    const corsProxies = [
        {
            prefix: 'https://api.allorigins.win/raw?url=',
            name: 'AllOrigins'
        },
        {
            prefix: 'https://corsproxy.io/?',
            name: 'CORSProxy.io'
        },
        {
            prefix: 'https://api.codetabs.com/v1/proxy?quest=',
            name: 'CodeTabs'
        }
    ];
    
    for (const proxy of corsProxies) {
        try {
            const proxyUrl = proxy.prefix + encodeURIComponent(url);
            console.log(`Trying CORS proxy: ${proxy.name}`);
            
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.ok) {
                const text = await response.text();
                // Validate we got actual HTML content
                if (text && text.length > 100 && (text.includes('<html') || text.includes('<!DOCTYPE'))) {
                    console.log(`Successfully fetched via ${proxy.name}`);
                    return text;
                } else {
                    console.warn(`${proxy.name} returned invalid content (too short or not HTML)`);
                }
            } else {
                console.warn(`${proxy.name} returned status ${response.status}`);
            }
        } catch (error) {
            console.log(`${proxy.name} failed:`, error.message);
            continue;
        }
    }
    
    throw new Error('Failed to fetch URL with all CORS proxy attempts. The website may be blocking requests or the proxies may be temporarily unavailable.');
}

/**
 * Parse HTML string into a DOM document
 * @param {string} html - HTML content
 * @returns {Document} DOM document
 */
function parseHTML(html) {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
}

/**
 * Extract text content from an element, cleaning it up
 * @param {Element} element - DOM element
 * @returns {string} Cleaned text content
 */
function extractText(element) {
    if (!element) return '';
    return element.textContent?.trim().replace(/\s+/g, ' ') || '';
}

/**
 * Extract number from text (removes currency symbols, units, etc.)
 * @param {string} text - Text containing a number
 * @returns {number|null} Extracted number or null
 */
function extractNumber(text) {
    if (!text) return null;
    // Remove currency symbols, commas, and extract first number
    const match = text.replace(/[$,\s]/g, '').match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : null;
}

/**
 * Extract weight in grams from text
 * @param {string} text - Text containing weight/quantity
 * @returns {number|null} Weight in grams or null
 */
function extractWeightInGrams(text) {
    if (!text) return null;
    
    const weightPatterns = [
        { regex: /(\d+\.?\d*)\s*(?:g|gram|grams)/i, multiplier: 1 },
        { regex: /(\d+\.?\d*)\s*(?:kg|kilogram|kilograms)/i, multiplier: 1000 },
        { regex: /(\d+\.?\d*)\s*(?:oz|ounce|ounces)/i, multiplier: 28.35 },
        { regex: /(\d+\.?\d*)\s*(?:lb|lbs|pound|pounds)/i, multiplier: 453.592 },
        { regex: /(\d+\.?\d*)\s*(?:ml|milliliter|milliliters)/i, multiplier: 1 }, // Approximate 1ml = 1g
        { regex: /(\d+\.?\d*)\s*(?:l|liter|liters)/i, multiplier: 1000 },
    ];
    
    for (const pattern of weightPatterns) {
        const match = text.match(pattern.regex);
        if (match) {
            const value = parseFloat(match[1]);
            return value * pattern.multiplier;
        }
    }
    
    // Try to extract just a number as grams
    const numberMatch = text.match(/(\d+\.?\d*)/);
    if (numberMatch) {
        return parseFloat(numberMatch[1]);
    }
    
    return null;
}

/**
 * Wegmans-specific data mapping for CSS selectors
 * Maps field names to arrays of possible CSS selectors to try
 */
const WEGMANS_SELECTORS = {
    name: [
        'h1[data-testid="product-title"]',
        'h1.product-title',
        '.product-name h1',
        'h1',
        '[data-testid="product-name"]',
        '.PDPProductTile-title',
        '.product-detail-title'
    ],
    price: [
        '[data-testid="product-price"]',
        '.product-price',
        '.price-value',
        '[data-testid="price"]',
        '.PDPProductTile-price',
        '.product-detail-price',
        '.price'
    ],
    size: [
        '[data-testid="product-size"]',
        '.product-size',
        '.size-value',
        '.quantity',
        '.product-quantity',
        '[data-testid="quantity"]',
        '.PDPProductTile-size'
    ],
    servingSize: [
        '.serving-size-value',
        '[data-serving-size]',
        '.nutrition-serving-size'
    ],
    nutrition: {
        calories: [
            '.calories-value',
            '[data-calories]',
            '.nutrition-calories',
            '.calories'
        ],
        fat: [
            '.fat-value',
            '[data-fat]',
            '.nutrition-fat',
            '.total-fat-value',
            '.fat'
        ],
        carbs: [
            '.carbs-value',
            '[data-carbs]',
            '.nutrition-carbs',
            '.carbohydrate-value',
            '.carbs',
            '.carbohydrates'
        ],
        protein: [
            '.protein-value',
            '[data-protein]',
            '.nutrition-protein',
            '.protein'
        ]
    }
};

/**
 * Try multiple selectors and return the first match
 * @param {Document} doc - DOM document
 * @param {Array<string>} selectors - Array of CSS selectors to try
 * @returns {Element|null} First matching element or null
 */
function trySelectors(doc, selectors) {
    for (const selector of selectors) {
        const element = doc.querySelector(selector);
        if (element) {
            return element;
        }
    }
    return null;
}

/**
 * Scrape Wegmans product page
 * @param {string} url - Wegmans product URL
 * @returns {Promise<Object>} Scraped product data
 */
/**
 * Debug function to log all elements matching nutrition-related selectors
 * @param {Document} doc - DOM document
 */
function debugNutritionElements(doc) {
    console.log('=== Debugging Wegmans nutrition elements ===');
    
    // Log all elements with nutrition-related classes/ids
    const nutritionClasses = [
        'calories', 'calorie', 'fat', 'carb', 'protein', 
        'nutrition', 'serving', 'value'
    ];
    
    nutritionClasses.forEach(className => {
        const elements = doc.querySelectorAll(`[class*="${className}" i], [id*="${className}" i]`);
        if (elements.length > 0) {
            console.log(`Found ${elements.length} elements with "${className}":`);
            Array.from(elements).slice(0, 5).forEach(elem => {
                console.log(`  - ${elem.tagName}.${elem.className || ''}#${elem.id || ''}: "${extractText(elem).substring(0, 50)}"`);
            });
        }
    });
    
    console.log('=== End debugging ===');
}

/**
 * Scrape Wegmans product page
 * @param {string} url - Wegmans product URL
 * @returns {Promise<Object>} Scraped product data
 */
async function scrapeWegmansProduct(url) {
    try {
        console.log('Scraping Wegmans product:', url);
        const html = await fetchWithCorsProxy(url);
        const doc = parseHTML(html);
        
        // Debug: Log nutrition-related elements found on the page
        debugNutritionElements(doc);
        
        const product = {
            name: '',
            price: null,
            totalWeight: null,
            servingSize: 100, // Default
            nutrition: {
                calories: 0,
                fat: 0,
                carbs: 0,
                protein: 0
            }
        };
        
        // Extract product name using Wegmans selectors
        const nameElement = trySelectors(doc, WEGMANS_SELECTORS.name);
        if (nameElement) {
            product.name = extractText(nameElement);
            console.log('Found product name:', product.name);
        }
        
        // Extract price using Wegmans selectors
        const priceElement = trySelectors(doc, WEGMANS_SELECTORS.price);
        if (priceElement) {
            const priceText = extractText(priceElement);
            product.price = extractNumber(priceText);
            console.log('Found price:', product.price);
        }
        
        // Extract size/weight
        const sizeElement = trySelectors(doc, WEGMANS_SELECTORS.size);
        if (sizeElement) {
            const sizeText = extractText(sizeElement);
            product.totalWeight = extractWeightInGrams(sizeText);
            console.log('Found total weight:', product.totalWeight);
        }
        
        // If we didn't find size, look in the product name
        if (!product.totalWeight && product.name) {
            product.totalWeight = extractWeightInGrams(product.name);
            if (product.totalWeight) {
                console.log('Extracted weight from product name:', product.totalWeight);
            }
        }
        
        // Extract serving size
        const servingSizeElement = trySelectors(doc, WEGMANS_SELECTORS.servingSize);
        if (servingSizeElement) {
            const servingSizeText = extractText(servingSizeElement);
            const servingSize = extractWeightInGrams(servingSizeText);
            if (servingSize) {
                product.servingSize = servingSize;
                console.log('Found serving size:', product.servingSize);
            }
        }
        
        // Extract nutrition values using Wegmans-specific selectors
        // Try direct value classes first (e.g., .calories-value)
        const caloriesElement = trySelectors(doc, WEGMANS_SELECTORS.nutrition.calories);
        if (caloriesElement) {
            const caloriesText = extractText(caloriesElement);
            product.nutrition.calories = extractNumber(caloriesText) || 0;
            console.log('Found calories via selector:', product.nutrition.calories, 'from:', caloriesText);
        } else {
            // Try searching the entire document for calories-related elements
            const allCaloriesElements = doc.querySelectorAll('[class*="calories"], [id*="calories"], [data-calories]');
            for (const elem of allCaloriesElements) {
                const text = extractText(elem);
                const num = extractNumber(text);
                if (num && num > 0 && num < 10000) { // Reasonable calorie range
                    product.nutrition.calories = num;
                    console.log('Found calories via fallback search:', num, 'from:', text);
                    break;
                }
            }
        }
        
        const fatElement = trySelectors(doc, WEGMANS_SELECTORS.nutrition.fat);
        if (fatElement) {
            const fatText = extractText(fatElement);
            product.nutrition.fat = extractNumber(fatText) || 0;
            console.log('Found fat via selector:', product.nutrition.fat);
        } else {
            // Fallback search for fat
            const allFatElements = doc.querySelectorAll('[class*="fat"], [id*="fat"], [data-fat]');
            for (const elem of allFatElements) {
                const label = extractText(elem).toLowerCase();
                if (label.includes('total fat') || (label.includes('fat') && !label.includes('saturated'))) {
                    const text = extractText(elem);
                    const num = extractNumber(text);
                    if (num && num >= 0 && num < 200) { // Reasonable fat range
                        product.nutrition.fat = num;
                        console.log('Found fat via fallback search:', num);
                        break;
                    }
                }
            }
        }
        
        const carbsElement = trySelectors(doc, WEGMANS_SELECTORS.nutrition.carbs);
        if (carbsElement) {
            const carbsText = extractText(carbsElement);
            product.nutrition.carbs = extractNumber(carbsText) || 0;
            console.log('Found carbs via selector:', product.nutrition.carbs);
        } else {
            // Fallback search for carbs
            const allCarbsElements = doc.querySelectorAll('[class*="carb"], [id*="carb"], [data-carbs]');
            for (const elem of allCarbsElements) {
                const label = extractText(elem).toLowerCase();
                if (label.includes('carbohydrate') || label.includes('carb')) {
                    const text = extractText(elem);
                    const num = extractNumber(text);
                    if (num && num >= 0 && num < 500) { // Reasonable carbs range
                        product.nutrition.carbs = num;
                        console.log('Found carbs via fallback search:', num);
                        break;
                    }
                }
            }
        }
        
        const proteinElement = trySelectors(doc, WEGMANS_SELECTORS.nutrition.protein);
        if (proteinElement) {
            const proteinText = extractText(proteinElement);
            product.nutrition.protein = extractNumber(proteinText) || 0;
            console.log('Found protein via selector:', product.nutrition.protein);
        } else {
            // Fallback search for protein
            const allProteinElements = doc.querySelectorAll('[class*="protein"], [id*="protein"], [data-protein]');
            for (const elem of allProteinElements) {
                const text = extractText(elem);
                const num = extractNumber(text);
                if (num && num >= 0 && num < 200) { // Reasonable protein range
                    product.nutrition.protein = num;
                    console.log('Found protein via fallback search:', num);
                    break;
                }
            }
        }
        
        // If we didn't find nutrition values via direct selectors, try nutrition facts table
        if (!product.nutrition.calories && !product.nutrition.fat && !product.nutrition.carbs && !product.nutrition.protein) {
            const nutritionSelectors = [
                '.nutrition-facts',
                '[data-testid="nutrition-facts"]',
                '.nutrition-information',
                '.product-nutrition',
                'table.nutrition-facts',
                '.nutrition-label'
            ];
            
            let nutritionTable = trySelectors(doc, nutritionSelectors);
            
            if (nutritionTable) {
                // First, try to extract serving size from the table
                const tableText = nutritionTable.textContent || '';
                const servingSizeMatch = tableText.match(/serving size[:\s]*(\d+\.?\d*)\s*(?:g|gram|grams|oz|ounce|ounces|ml|milliliter)/i);
                if (servingSizeMatch) {
                    product.servingSize = extractWeightInGrams(servingSizeMatch[0]) || product.servingSize;
                }
                
                // Parse nutrition table rows
                const rows = nutritionTable.querySelectorAll('tr, .nutrition-row, .nutrition-item');
                rows.forEach(row => {
                    const label = extractText(row.querySelector('td:first-child, .nutrition-label, th, .nutrition-name')).toLowerCase();
                    const value = extractText(row.querySelector('td:last-child, .nutrition-value, td:nth-child(2), .nutrition-amount'));
                    const numValue = extractNumber(value);
                    
                    if (label.includes('serving size')) {
                        const servingSize = extractWeightInGrams(value);
                        if (servingSize) product.servingSize = servingSize;
                    } else if (label.includes('calorie')) {
                        product.nutrition.calories = numValue || 0;
                    } else if (label.includes('total fat') || (label.includes('fat') && !label.includes('saturated') && !label.includes('trans'))) {
                        product.nutrition.fat = numValue || 0;
                    } else if (label.includes('total carbohydrate') || (label.includes('carbohydrate') || label.includes('carb')) && !label.includes('fiber') && !label.includes('sugar')) {
                        product.nutrition.carbs = numValue || 0;
                    } else if (label.includes('protein')) {
                        product.nutrition.protein = numValue || 0;
                    }
                });
                
                if (product.nutrition.calories || product.nutrition.fat || product.nutrition.carbs || product.nutrition.protein) {
                    console.log('Found nutrition from table:', product.nutrition);
                }
            }
        }
        
        // Try to find JSON-LD structured data which often contains nutrition info
        const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
        for (const script of jsonLdScripts) {
            try {
                const data = JSON.parse(script.textContent);
                // Handle arrays of structured data
                const dataArray = Array.isArray(data) ? data : [data];
                
                for (const item of dataArray) {
                    // Extract nutrition data
                    if (item.nutrition) {
                        if (item.nutrition.calories) product.nutrition.calories = parseFloat(item.nutrition.calories) || product.nutrition.calories;
                        if (item.nutrition.fatContent) product.nutrition.fat = extractNumber(item.nutrition.fatContent) || product.nutrition.fat;
                        if (item.nutrition.carbohydrateContent) product.nutrition.carbs = extractNumber(item.nutrition.carbohydrateContent) || product.nutrition.carbs;
                        if (item.nutrition.proteinContent) product.nutrition.protein = extractNumber(item.nutrition.proteinContent) || product.nutrition.protein;
                    }
                    
                    // Extract price from offers
                    if (item.offers) {
                        const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
                        for (const offer of offers) {
                            if (offer.price && !product.price) {
                                const price = typeof offer.price === 'string' ? extractNumber(offer.price) : parseFloat(offer.price);
                                if (price) product.price = price;
                            }
                        }
                    }
                    
                    // Extract weight/size
                    if (item.weight && !product.totalWeight) {
                        product.totalWeight = extractWeightInGrams(item.weight) || product.totalWeight;
                    }
                    
                    // Extract name if not already found
                    if ((item.name || item.title) && !product.name) {
                        product.name = item.name || item.title;
                    }
                }
            } catch (e) {
                // Ignore JSON parse errors
            }
        }
        
        // Try to find embedded product data in script tags (common in React/SPA sites)
        const scriptTags = doc.querySelectorAll('script:not([type])');
        for (const script of scriptTags) {
            const text = script.textContent || '';
            // Look for common product data patterns
            if (text.includes('product') || text.includes('price') || text.includes('nutrition')) {
                try {
                    // Try to extract JSON objects from script content
                    const jsonMatches = text.match(/\{[^{}]*(?:product|price|nutrition|name)[^{}]*\}/gi);
                    if (jsonMatches) {
                        for (const match of jsonMatches.slice(0, 3)) { // Limit to first 3 matches
                            try {
                                const data = JSON.parse(match);
                                if (data.name && !product.name) product.name = data.name;
                                if (data.price && !product.price) product.price = extractNumber(data.price.toString());
                                if (data.size && !product.totalWeight) product.totalWeight = extractWeightInGrams(data.size.toString());
                            } catch (e) {
                                // Skip invalid JSON
                            }
                        }
                    }
                } catch (e) {
                    // Continue to next script
                }
            }
        }
        
        // Try to find serving size
        const servingSizeText = doc.body.textContent.match(/serving size[:\s]*(\d+\.?\d*)\s*(?:g|gram|grams|oz|ounce|ounces)/i);
        if (servingSizeText) {
            product.servingSize = extractWeightInGrams(servingSizeText[0]) || product.servingSize;
        }
        
        console.log('Scraped Wegmans product:', product);
        return product;
    } catch (error) {
        console.error('Error scraping Wegmans product:', error);
        throw new Error(`Failed to scrape Wegmans product: ${error.message}`);
    }
}

/**
 * Scrape product information from a URL
 * Automatically detects the store/site type and uses appropriate scraper
 * @param {string} url - Product URL
 * @returns {Promise<Object>} Scraped product data
 */
export async function scrapeProduct(url) {
    if (!url || !url.trim()) {
        throw new Error('URL is required');
    }
    
    // Normalize URL
    const normalizedUrl = url.trim();
    
    // Detect site type
    if (normalizedUrl.includes('wegmans.com')) {
        return await scrapeWegmansProduct(normalizedUrl);
    } else {
        // For now, only support Wegmans
        throw new Error('Unsupported website. Currently only Wegmans.com is supported.');
    }
}

