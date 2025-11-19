// Open Food Facts API Service
// Free, open database of food products with barcode and nutrition data
// Documentation: https://world.openfoodfacts.org/data
import { getCachedResults, setCachedResults } from './food-cache.js';

/**
 * Search for foods using Open Food Facts API
 * @param {string} query - Search query (product name, brand, etc.)
 * @param {number} pageSize - Number of results to return (max 20 per page)
 * @returns {Promise<Array>} Array of food results
 */
export async function searchOpenFoodFacts(query, pageSize = 20) {
    if (!query || query.trim().length < 2) {
        console.log('Open Food Facts search skipped: query too short');
        return [];
    }

    try {
        // Open Food Facts search endpoint
        // Documentation: https://world.openfoodfacts.org/data
        // Search by product name using the search_terms parameter
        const searchParams = new URLSearchParams({
            action: 'process',
            search_terms: query.trim(),
            page_size: Math.min(pageSize, 20), // Open Food Facts limits to 20 per page
            json: '1',
            fields: 'code,product_name,product_name_en,product_name_fr,generic_name,brands,quantity,nutriments,serving_size,nutrition_grade_fr,image_url,image_small_url,prices,price,price_per_unit,price_per_100g'
        });

        const url = `https://world.openfoodfacts.org/cgi/search.pl?${searchParams.toString()}`;
        console.log('Open Food Facts API URL:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Meal-E App - https://github.com/pstrick/meal-e'
            }
        });
        console.log('Open Food Facts API response status:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Open Food Facts API error response:', errorText);
            throw new Error(`Open Food Facts API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Open Food Facts API response data:', {
            count: data.count,
            page: data.page,
            page_size: data.page_size,
            productsCount: data.products ? data.products.length : 0,
            hasProducts: !!data.products
        });
        
        const products = data.products || [];
        
        // Filter out products with no valid name (invalid products)
        // A valid name is not just numbers, not empty, and exists in at least one language field
        const validProducts = products.filter(p => {
            const name = p.product_name || p.product_name_en || p.product_name_fr || 
                        p.generic_name || p.generic_name_en || p.abbreviated_product_name || '';
            // Reject if name is empty, just numbers, or just the barcode
            if (!name || name.trim() === '') return false;
            if (/^\d+$/.test(name.trim())) return false;
            if (name.trim() === p.code) return false; // Name is just the barcode
            return true;
        });
        console.log('Open Food Facts API returning', validProducts.length, 'valid products (filtered from', products.length, 'total)');
        
        if (validProducts.length === 0 && products.length > 0) {
            console.warn('All Open Food Facts products were filtered out (no valid product names)');
            console.log('Sample product structure:', products[0]);
        }
        
        return validProducts;
    } catch (error) {
        console.error('Error searching Open Food Facts:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        // Return empty array on error so app continues to work
        return [];
    }
}

/**
 * Extract nutrition data from Open Food Facts product
 * @param {Object} product - Open Food Facts product object
 * @returns {Object} Nutrition data per 100g
 */
export function extractOpenFoodFactsNutrition(product) {
    if (!product || !product.nutriments) {
        console.warn('extractOpenFoodFactsNutrition: No product or nutriments found', {
            hasProduct: !!product,
            hasNutriments: !!(product && product.nutriments),
            productKeys: product ? Object.keys(product).slice(0, 10) : []
        });
        return {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
        };
    }

    const nutriments = product.nutriments;
    
    // Log all nutriments keys for debugging
    const allKeys = Object.keys(nutriments);
    const nutritionKeys = allKeys.filter(k => 
        k.includes('energy') || k.includes('protein') || k.includes('carb') || k.includes('fat') ||
        k.includes('calorie') || k.includes('kcal') || k.includes('kj')
    );
    console.log('Open Food Facts nutriments keys (nutrition-related):', nutritionKeys);
    console.log('Sample nutriments values:', Object.fromEntries(
        nutritionKeys.slice(0, 8).map(k => [k, nutriments[k]])
    ));
    
    // Open Food Facts provides values per 100g
    // Energy can be in different formats: energy-kcal_100g, energy-kcal, energy_100g (in kJ)
    // Try multiple field names to find the data
    let calories = nutriments['energy-kcal_100g'] || 
                   nutriments['energy-kcal'] || 
                   nutriments['energy-kcal_value'] ||
                   (nutriments['energy-kj_100g'] ? nutriments['energy-kj_100g'] / 4.184 : 0) || // Convert kJ to kcal
                   (nutriments['energy-kj'] ? nutriments['energy-kj'] / 4.184 : 0) ||
                   (nutriments['energy_100g'] ? nutriments['energy_100g'] / 4.184 : 0) || // Convert kJ to kcal
                   (nutriments['energy'] ? nutriments['energy'] / 4.184 : 0) || 0; // Convert kJ to kcal
    
    const protein = nutriments['proteins_100g'] || 
                    nutriments['proteins'] || 
                    nutriments['protein_100g'] || 
                    nutriments['protein'] ||
                    nutriments['proteins_value'] ||
                    nutriments['protein_value'] || 0;
    
    const carbs = nutriments['carbohydrates_100g'] || 
                  nutriments['carbohydrates'] || 
                  nutriments['carbohydrate_100g'] || 
                  nutriments['carbohydrate'] ||
                  nutriments['carbohydrates_value'] ||
                  nutriments['carbohydrate_value'] || 0;
    
    const fat = nutriments['fat_100g'] || 
                nutriments['fat'] || 
                nutriments['total-fat_100g'] || 
                nutriments['total-fat'] ||
                nutriments['fat_value'] ||
                nutriments['total-fat_value'] || 0;

    console.log('Extracted Open Food Facts nutrition (per 100g):', { calories, protein, carbs, fat });

    // Convert to per-gram values (Open Food Facts data is per 100g)
    const servingSize = 100;
    
    const perGramNutrition = {
        calories: calories / servingSize,
        protein: protein / servingSize,
        carbs: carbs / servingSize,
        fat: fat / servingSize
    };
    
    console.log('Converted to per-gram nutrition:', perGramNutrition);
    
    return perGramNutrition;
}

/**
 * Convert Open Food Facts product to app format
 * @param {Object} product - Open Food Facts product object
 * @returns {Object} Formatted ingredient object
 */
export function formatOpenFoodFactsProduct(product) {
    if (!product) {
        console.warn('formatOpenFoodFactsProduct received null/undefined product');
        return null;
    }
    
    console.log('Formatting Open Food Facts product:', {
        code: product.code,
        product_name: product.product_name,
        brands: product.brands,
        hasNutriments: !!product.nutriments,
        nutrimentsKeys: product.nutriments ? Object.keys(product.nutriments).slice(0, 10) : []
    });
    
    const nutrition = extractOpenFoodFactsNutrition(product);
    
    // Validate nutrition data - require at least calories OR at least one macro
    const hasValidNutrition = nutrition && (
        nutrition.calories > 0 || 
        nutrition.protein > 0 || 
        nutrition.carbs > 0 || 
        nutrition.fat > 0
    );
    
    if (!hasValidNutrition) {
        console.warn('Open Food Facts product has no valid nutrition data (calories or macros) - filtering out:', {
            code: product.code,
            product_name: product.product_name,
            hasNutriments: !!product.nutriments,
            nutrimentsKeys: product.nutriments ? Object.keys(product.nutriments) : [],
            extractedNutrition: nutrition
        });
        // Return null to filter out products with no nutrition data
        return null;
    }
    
    // Extract product name - try multiple fields and filter out numeric-only names
    let productName = product.product_name || 
                      product.product_name_en || 
                      product.product_name_fr || 
                      product.product_name_de ||
                      product.product_name_es ||
                      product.generic_name ||
                      product.generic_name_en ||
                      '';
    
    // Filter out names that are just numbers or barcodes
    if (productName && /^\d+$/.test(productName.trim())) {
        console.warn('Product name is numeric only, trying alternatives:', productName);
        productName = product.generic_name || 
                      product.generic_name_en ||
                      product.abbreviated_product_name ||
                      '';
    }
    
    // If still no valid name, try to construct from brand and quantity
    if (!productName || productName.trim() === '' || /^\d+$/.test(productName.trim())) {
        const brands = product.brands || product.brand || '';
        const quantity = product.quantity || '';
        if (brands && brands !== 'Unknown brand') {
            productName = brands;
            if (quantity) {
                productName += ` ${quantity}`;
            }
        } else if (quantity) {
            productName = quantity;
        } else {
            productName = 'Unknown product';
        }
    }
    
    const brands = product.brands || product.brand || '';
    const quantity = product.quantity || '';
    
    // Combine brand and product name, but avoid duplication
    let displayName = productName;
    if (brands && brands !== 'Unknown brand' && brands.trim() !== '' && !productName.toLowerCase().includes(brands.toLowerCase())) {
        displayName = `${productName} (${brands})`;
    }
    
    if (!product.code) {
        console.warn('Open Food Facts product missing code:', product);
        return null;
    }
    
    // Extract pricing information
    // Open Food Facts may have prices in various formats
    let pricePerGram = null;
    let pricePer100g = null;
    let totalPrice = null;
    
    // Try to get price per 100g first (most useful for our use case)
    if (product.price_per_100g) {
        pricePer100g = parseFloat(product.price_per_100g);
        pricePerGram = pricePer100g / 100;
    } else if (product.price_per_unit) {
        // If price_per_unit exists, try to extract it
        const priceUnit = parseFloat(product.price_per_unit);
        if (priceUnit > 0) {
            // Assume it's per 100g if no other info
            pricePer100g = priceUnit;
            pricePerGram = priceUnit / 100;
        }
    } else if (product.price) {
        // If there's a single price field, try to use it
        const price = parseFloat(product.price);
        if (price > 0) {
            // Try to get quantity to calculate per gram
            const qtyMatch = quantity.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb)/i);
            if (qtyMatch) {
                const qtyValue = parseFloat(qtyMatch[1]);
                const qtyUnit = qtyMatch[2].toLowerCase();
                // Convert to grams
                let qtyInGrams = qtyValue;
                if (qtyUnit === 'kg') qtyInGrams = qtyValue * 1000;
                else if (qtyUnit === 'ml') qtyInGrams = qtyValue; // Approximate 1ml = 1g
                else if (qtyUnit === 'l') qtyInGrams = qtyValue * 1000; // 1 liter = 1000ml ≈ 1000g
                else if (qtyUnit === 'oz') qtyInGrams = qtyValue * 28.35;
                else if (qtyUnit === 'lb') qtyInGrams = qtyValue * 453.592;
                
                if (qtyInGrams > 0) {
                    pricePerGram = price / qtyInGrams;
                    pricePer100g = pricePerGram * 100;
                    totalPrice = price;
                }
            }
        }
    } else if (product.prices && Array.isArray(product.prices) && product.prices.length > 0) {
        // If prices is an array, use the first available price
        const firstPrice = product.prices[0];
        if (firstPrice && firstPrice.price) {
            const price = parseFloat(firstPrice.price);
            if (price > 0) {
                // Try to get the unit/quantity from the price object
                if (firstPrice.unit && firstPrice.unit === '100g') {
                    pricePer100g = price;
                    pricePerGram = price / 100;
                } else if (firstPrice.quantity) {
                    const qty = parseFloat(firstPrice.quantity);
                    if (qty > 0) {
                        pricePerGram = price / qty;
                        pricePer100g = pricePerGram * 100;
                        totalPrice = price;
                    }
                }
            }
        }
    }
    
    const formatted = {
        id: product.code,
        fdcId: `off-${product.code}`, // Open Food Facts uses barcode as ID
        name: displayName,
        source: 'openfoodfacts',
        nutrition: {
            calories: nutrition.calories || 0,
            protein: nutrition.protein || 0,
            carbs: nutrition.carbs || 0,
            fat: nutrition.fat || 0
        },
        servingSize: 100, // Open Food Facts data is per 100g
        brandOwner: brands,
        quantity: quantity,
        barcode: product.code,
        imageUrl: product.image_url || product.image_small_url || '',
        nutritionGrade: product.nutrition_grade_fr || '',
        storeSection: '', // Open Food Facts doesn't provide store sections
        emoji: '', // Open Food Facts doesn't provide emojis
        pricePerGram: pricePerGram,
        pricePer100g: pricePer100g,
        totalPrice: totalPrice
    };
    
    console.log('Formatted Open Food Facts product with nutrition and pricing:', {
        name: formatted.name,
        nutrition: formatted.nutrition,
        code: formatted.barcode,
        pricePerGram: formatted.pricePerGram,
        pricePer100g: formatted.pricePer100g,
        totalPrice: formatted.totalPrice
    });
    return formatted;
}

/**
 * Search Open Food Facts and return formatted results
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results
 * @returns {Promise<Array>} Array of formatted ingredient objects
 */
export async function searchOpenFoodFactsIngredients(query, maxResults = 10) {
    try {
        console.log('searchOpenFoodFactsIngredients called with query:', query, 'maxResults:', maxResults);
        
        // Check cache first
        const cachedResults = await getCachedResults(query, 'openfoodfacts', maxResults);
        if (cachedResults !== null) {
            console.log('Returning cached Open Food Facts results:', cachedResults.length, 'items');
            return cachedResults;
        }
        
        // Cache miss - make API call
        console.log('Cache miss for Open Food Facts query:', query, '- making API call');
        const products = await searchOpenFoodFacts(query, maxResults);
        console.log('searchOpenFoodFacts returned', products.length, 'products');
        
        if (products.length === 0) {
            console.warn('No products returned from Open Food Facts API for query:', query);
            return [];
        }
        
        let formatted = products
            .map(formatOpenFoodFactsProduct)
            .filter(product => product !== null);
        
        // Double-check: filter out any products that still don't have valid nutrition data
        formatted = formatted.filter(product => {
            if (!product || !product.nutrition) {
                return false;
            }
            const hasValidNutrition = 
                product.nutrition.calories > 0 || 
                product.nutrition.protein > 0 || 
                product.nutrition.carbs > 0 || 
                product.nutrition.fat > 0;
            
            if (!hasValidNutrition) {
                console.log('Filtering out Open Food Facts product without valid nutrition:', product.name);
            }
            return hasValidNutrition;
        });
        
        const filteredCount = products.length - formatted.length;
        if (filteredCount > 0) {
            console.log(`Filtered out ${filteredCount} Open Food Facts products with no valid nutrition data`);
        }
        console.log('After filtering for valid nutrition:', formatted.length, 'Open Food Facts ingredients remain');
        
        // Cache the results for future use
        await setCachedResults(query, 'openfoodfacts', formatted, maxResults);
        
        return formatted;
    } catch (error) {
        console.error('Error searching Open Food Facts ingredients:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        return [];
    }
}


