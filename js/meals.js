const MEALS_STORAGE_KEY = 'meals';
const INGREDIENTS_STORAGE_KEY = 'meale-my-ingredients';
const LEGACY_INGREDIENTS_STORAGE_KEY = 'meale-custom-ingredients';

function compareIds(a, b) {
    return String(a) === String(b);
}

function normalizeComponent(component) {
    const rawType = String(component?.type || '').trim().toLowerCase();
    const type = rawType === 'recipe' || rawType === 'ingredient' ? rawType : 'ingredient';
    const amount = Number.parseFloat(component?.amount);
    return {
        type,
        id: component?.id ?? '',
        amount: Number.isFinite(amount) && amount > 0 ? amount : 0
    };
}

function normalizeMeal(meal) {
    const servingSize = Number.parseFloat(meal?.servingSize);
    const normalizedComponents = Array.isArray(meal?.components)
        ? meal.components.map(normalizeComponent).filter((component) => component.id && component.amount > 0)
        : [];

    const inferredServingSize = normalizedComponents.reduce((total, component) => total + component.amount, 0);

    return {
        id: meal?.id ?? Date.now(),
        name: String(meal?.name || '').trim() || 'Untitled Meal',
        category: String(meal?.category || '').trim() || 'dinner',
        notes: String(meal?.notes || '').trim(),
        servingSize: Number.isFinite(servingSize) && servingSize > 0
            ? servingSize
            : (inferredServingSize > 0 ? inferredServingSize : 100),
        components: normalizedComponents,
        createdAt: meal?.createdAt || new Date().toISOString(),
        updatedAt: meal?.updatedAt || new Date().toISOString()
    };
}

function migrateIngredientsStorageKey() {
    const existing = localStorage.getItem(INGREDIENTS_STORAGE_KEY);
    const legacy = localStorage.getItem(LEGACY_INGREDIENTS_STORAGE_KEY);
    if (!existing && legacy) {
        localStorage.setItem(INGREDIENTS_STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_INGREDIENTS_STORAGE_KEY);
    }
}

export function loadMeals() {
    try {
        const raw = localStorage.getItem(MEALS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalizeMeal);
    } catch (error) {
        console.error('Error loading meals:', error);
        return [];
    }
}

export function saveMeals(meals) {
    try {
        const normalized = Array.isArray(meals) ? meals.map(normalizeMeal) : [];
        localStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    } catch (error) {
        console.error('Error saving meals:', error);
        return [];
    }
}

export function loadRecipes() {
    try {
        const globalRecipes = Array.isArray(window.recipes) ? window.recipes : null;
        if (globalRecipes) return globalRecipes;
        const raw = localStorage.getItem('recipes');
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Error loading recipes:', error);
        return [];
    }
}

export function loadIngredients() {
    try {
        migrateIngredientsStorageKey();
        const raw = localStorage.getItem(INGREDIENTS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Error loading ingredients:', error);
        return [];
    }
}

function findRecipeById(recipes, recipeId) {
    return recipes.find((recipe) => compareIds(recipe.id, recipeId)) || null;
}

function findIngredientById(ingredients, ingredientId) {
    const normalizedId = String(ingredientId || '').replace(/^custom-/, '');
    return ingredients.find((ingredient) => compareIds(ingredient.id, normalizedId)) || null;
}

function ingredientNutritionPerGram(ingredient) {
    const servingSize = Number.parseFloat(ingredient?.servingSize);
    const divisor = Number.isFinite(servingSize) && servingSize > 0 ? servingSize : 100;
    const nutrition = ingredient?.nutrition || {};
    return {
        calories: (Number(nutrition.calories) || 0) / divisor,
        protein: (Number(nutrition.protein) || 0) / divisor,
        carbs: (Number(nutrition.carbs) || 0) / divisor,
        fat: (Number(nutrition.fat) || 0) / divisor
    };
}

function recipeNutritionPerGram(recipe) {
    const servingSize = Number.parseFloat(recipe?.servingSize);
    const divisor = Number.isFinite(servingSize) && servingSize > 0 ? servingSize : 100;
    const nutrition = recipe?.nutrition || {};
    return {
        calories: (Number(nutrition.calories) || 0) / divisor,
        protein: (Number(nutrition.protein) || 0) / divisor,
        carbs: (Number(nutrition.carbs) || 0) / divisor,
        fat: (Number(nutrition.fat) || 0) / divisor
    };
}

function ingredientCostPerGram(ingredient) {
    if (Number.isFinite(ingredient?.pricePerGram) && ingredient.pricePerGram >= 0) {
        return Number(ingredient.pricePerGram);
    }
    const totalPrice = Number.parseFloat(ingredient?.totalPrice);
    const totalWeight = Number.parseFloat(ingredient?.totalWeight);
    if (Number.isFinite(totalPrice) && totalPrice >= 0 && Number.isFinite(totalWeight) && totalWeight > 0) {
        return totalPrice / totalWeight;
    }
    return 0;
}

function recipeCostPerGram(recipe) {
    if (!Array.isArray(recipe?.ingredients) || recipe.ingredients.length === 0) return 0;
    let totalCost = 0;
    let totalWeight = 0;
    recipe.ingredients.forEach((ingredient) => {
        const amount = Number.parseFloat(ingredient?.amount);
        if (Number.isFinite(amount) && amount > 0) {
            totalWeight += amount;
            if (Number.isFinite(ingredient?.totalPrice) && ingredient.totalPrice >= 0) {
                totalCost += Number(ingredient.totalPrice);
            } else if (Number.isFinite(ingredient?.pricePerGram) && ingredient.pricePerGram >= 0) {
                totalCost += Number(ingredient.pricePerGram) * amount;
            }
        }
    });
    if (totalWeight <= 0 || totalCost <= 0) return 0;
    return totalCost / totalWeight;
}

export function resolveMealComponents(meal, options = {}) {
    const recipes = Array.isArray(options.recipes) ? options.recipes : loadRecipes();
    const ingredients = Array.isArray(options.ingredients) ? options.ingredients : loadIngredients();
    const normalizedMeal = normalizeMeal(meal);

    return normalizedMeal.components.map((component) => {
        if (component.type === 'recipe') {
            const recipe = findRecipeById(recipes, component.id);
            if (!recipe) {
                return {
                    ...component,
                    missing: true,
                    name: 'Missing recipe',
                    nutritionPerGram: { calories: 0, protein: 0, carbs: 0, fat: 0 },
                    costPerGram: 0
                };
            }
            return {
                ...component,
                missing: false,
                name: recipe.name || 'Recipe',
                recipe,
                nutritionPerGram: recipeNutritionPerGram(recipe),
                costPerGram: recipeCostPerGram(recipe)
            };
        }

        const ingredient = findIngredientById(ingredients, component.id);
        if (!ingredient) {
            return {
                ...component,
                missing: true,
                name: 'Missing ingredient',
                nutritionPerGram: { calories: 0, protein: 0, carbs: 0, fat: 0 },
                costPerGram: 0
            };
        }
        return {
            ...component,
            id: ingredient.id,
            missing: false,
            name: ingredient.name || 'Ingredient',
            ingredient,
            nutritionPerGram: ingredientNutritionPerGram(ingredient),
            costPerGram: ingredientCostPerGram(ingredient)
        };
    });
}

export function calculateMealTotals(meal, targetAmount = null, options = {}) {
    const normalizedMeal = normalizeMeal(meal);
    const resolvedComponents = resolveMealComponents(normalizedMeal, options);
    const baseAmount = Number.parseFloat(normalizedMeal.servingSize) || 100;
    const safeBaseAmount = baseAmount > 0 ? baseAmount : 100;
    const requestedAmount = Number.parseFloat(targetAmount);
    const finalAmount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : safeBaseAmount;
    const scaleFactor = finalAmount / safeBaseAmount;

    const baseTotals = resolvedComponents.reduce((totals, component) => {
        const componentAmount = Number.parseFloat(component.amount) || 0;
        totals.calories += (component.nutritionPerGram.calories || 0) * componentAmount;
        totals.protein += (component.nutritionPerGram.protein || 0) * componentAmount;
        totals.carbs += (component.nutritionPerGram.carbs || 0) * componentAmount;
        totals.fat += (component.nutritionPerGram.fat || 0) * componentAmount;
        totals.cost += (component.costPerGram || 0) * componentAmount;
        return totals;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, cost: 0 });

    return {
        amount: finalAmount,
        servingSize: safeBaseAmount,
        scaleFactor,
        nutrition: {
            calories: baseTotals.calories * scaleFactor,
            protein: baseTotals.protein * scaleFactor,
            carbs: baseTotals.carbs * scaleFactor,
            fat: baseTotals.fat * scaleFactor
        },
        cost: baseTotals.cost * scaleFactor,
        components: resolvedComponents
    };
}

export function expandMealToIngredients(meal, targetAmount = null, options = {}) {
    const recipes = Array.isArray(options.recipes) ? options.recipes : loadRecipes();
    const ingredients = Array.isArray(options.ingredients) ? options.ingredients : loadIngredients();
    const normalizedMeal = normalizeMeal(meal);

    const baseAmount = Number.parseFloat(normalizedMeal.servingSize) || 100;
    const safeBaseAmount = baseAmount > 0 ? baseAmount : 100;
    const requestedAmount = Number.parseFloat(targetAmount);
    const finalAmount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : safeBaseAmount;
    const mealScale = finalAmount / safeBaseAmount;

    const ingredientTotals = new Map();
    const addIngredientAmount = (key, payload) => {
        if (ingredientTotals.has(key)) {
            const existing = ingredientTotals.get(key);
            existing.amount += payload.amount;
            return;
        }
        ingredientTotals.set(key, payload);
    };

    normalizedMeal.components.forEach((component) => {
        const componentAmount = (Number.parseFloat(component.amount) || 0) * mealScale;
        if (componentAmount <= 0) return;

        if (component.type === 'ingredient') {
            const ingredient = findIngredientById(ingredients, component.id);
            if (!ingredient) return;
            const key = `${String(ingredient.id)}`;
            addIngredientAmount(key, {
                type: 'ingredient',
                id: ingredient.id,
                name: ingredient.name || 'Ingredient',
                amount: componentAmount,
                storeSection: ingredient.storeSection || '',
                emoji: ingredient.emoji || '',
                image: ingredient.image || '',
                source: 'meal-component'
            });
            return;
        }

        const recipe = findRecipeById(recipes, component.id);
        if (!recipe || !Array.isArray(recipe.ingredients)) return;
        const recipeServingSize = Number.parseFloat(recipe.servingSize);
        const recipeBase = Number.isFinite(recipeServingSize) && recipeServingSize > 0 ? recipeServingSize : 100;
        const recipeScale = componentAmount / recipeBase;

        recipe.ingredients.forEach((ingredientRef) => {
            const ingredientAmount = (Number.parseFloat(ingredientRef.amount) || 0) * recipeScale;
            if (ingredientAmount <= 0) return;

            const ingredient = findIngredientById(ingredients, ingredientRef.fdcId || ingredientRef.id || ingredientRef.name);
            const ingredientId = ingredient?.id || ingredientRef.fdcId || ingredientRef.id || ingredientRef.name;
            const ingredientName = ingredient?.name || ingredientRef.name || 'Ingredient';
            const key = `${String(ingredientId)}|${ingredientName.toLowerCase()}`;

            addIngredientAmount(key, {
                type: 'ingredient',
                id: ingredientId,
                name: ingredientName,
                amount: ingredientAmount,
                storeSection: ingredient?.storeSection || ingredientRef.storeSection || '',
                emoji: ingredient?.emoji || ingredientRef.emoji || '',
                image: ingredient?.image || ingredientRef.image || '',
                source: 'recipe-component'
            });
        });
    });

    return Array.from(ingredientTotals.values());
}

export function getMealsStorageKey() {
    return MEALS_STORAGE_KEY;
}
