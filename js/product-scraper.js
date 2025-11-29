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
 * Scrape Wegmans product page
 * @param {string} url - Wegmans product URL
 * @returns {Promise<Object>} Scraped product data
 */
async function scrapeWegmansProduct(url) {
    try {
        console.log('Scraping Wegmans product:', url);
        const html = await fetchWithCorsProxy(url);
        const doc = parseHTML(html);
        
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
        
        // Extract product name - Wegmans typically has this in various locations
        const nameSelectors = [
            'h1[data-testid="product-title"]',
            'h1.product-title',
            'h1.PDPProductTile-title',
            '.product-name h1',
            'h1',
            '[data-testid="product-name"]',
            '.product-detail-title'
        ];
        
        for (const selector of nameSelectors) {
            const element = doc.querySelector(selector);
            if (element) {
                product.name = extractText(element);
                if (product.name) break;
            }
        }
        
        // Extract price - Wegmans price selectors
        const priceSelectors = [
            '[data-testid="product-price"]',
            '.product-price',
            '.price',
            '.PDPProductTile-price',
            '[data-testid="price"]',
            '.product-detail-price'
        ];
        
        for (const selector of priceSelectors) {
            const element = doc.querySelector(selector);
            if (element) {
                const priceText = extractText(element);
                product.price = extractNumber(priceText);
                if (product.price) break;
            }
        }
        
        // Extract size/weight - look for quantity, size, or weight info
        const sizeSelectors = [
            '[data-testid="product-size"]',
            '.product-size',
            '.size',
            '.quantity',
            '.product-quantity',
            '[data-testid="quantity"]',
            '.PDPProductTile-size'
        ];
        
        for (const selector of sizeSelectors) {
            const element = doc.querySelector(selector);
            if (element) {
                const sizeText = extractText(element);
                product.totalWeight = extractWeightInGrams(sizeText);
                if (product.totalWeight) break;
            }
        }
        
        // If we didn't find size, look in the product name or description
        if (!product.totalWeight) {
            const descriptionSelectors = [
                '.product-description',
                '[data-testid="product-description"]',
                '.product-details',
                '.PDPProductTile-description'
            ];
            
            for (const selector of descriptionSelectors) {
                const element = doc.querySelector(selector);
                if (element) {
                    const descText = extractText(element);
                    product.totalWeight = extractWeightInGrams(descText);
                    if (product.totalWeight) break;
                }
            }
            
            // Also check the name itself
            if (!product.totalWeight && product.name) {
                product.totalWeight = extractWeightInGrams(product.name);
            }
        }
        
        // Extract nutrition facts - Wegmans may have this in different formats
        // Look for nutrition facts table or structured data
        const nutritionSelectors = [
            '.nutrition-facts',
            '[data-testid="nutrition-facts"]',
            '.nutrition-information',
            '.product-nutrition',
            'table.nutrition-facts'
        ];
        
        // Try to find nutrition facts table
        let nutritionTable = null;
        for (const selector of nutritionSelectors) {
            nutritionTable = doc.querySelector(selector);
            if (nutritionTable) break;
        }
        
        if (nutritionTable) {
            // First, try to extract serving size from the table
            const tableText = nutritionTable.textContent || '';
            const servingSizeMatch = tableText.match(/serving size[:\s]*(\d+\.?\d*)\s*(?:g|gram|grams|oz|ounce|ounces|ml|milliliter)/i);
            if (servingSizeMatch) {
                product.servingSize = extractWeightInGrams(servingSizeMatch[0]) || product.servingSize;
            }
            
            // Parse nutrition table rows
            const rows = nutritionTable.querySelectorAll('tr, .nutrition-row');
            rows.forEach(row => {
                const label = extractText(row.querySelector('td:first-child, .nutrition-label, th')).toLowerCase();
                const value = extractText(row.querySelector('td:last-child, .nutrition-value, td:nth-child(2)'));
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

