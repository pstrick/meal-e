import { version } from './version.js';
import { settings, applyDarkMode } from './settings.js';
import {
    ensureIconify,
    scanIconifyElements,
    normalizeIconValue,
    renderIcon,
    renderIconAsImage,
    iconifyToDataUrl,
    isDataUrl
} from './icon-utils.js';
import { searchUSDAIngredients } from './usda-api.js';
import { searchOpenFoodFactsIngredients } from './open-food-facts-api.js';

// Update version in footer
const versionEl = document.getElementById('version');
if (versionEl) versionEl.textContent = version;

// Custom ingredients data structure
let customIngredients = [];
let editingIngredientId = null;
let lastScrapedIngredientData = null;
let selectedIconValue = '';

const ICONIFY_FOOD_ICONS = [
    // Fruits - Material Design Icons
    { icon: 'mdi:food-apple', emoji: '🍎', label: 'Apple', keywords: ['apple', 'produce', 'fruit'] },
    { icon: 'mdi:food-apple-outline', emoji: '🍎', label: 'Apple Outline', keywords: ['apple', 'produce', 'fruit'] },
    { icon: 'mdi:food-apple-plus', emoji: '🍎', label: 'Apple Plus', keywords: ['apple', 'nutrition'] },
    { icon: 'mdi:food-banana', emoji: '🍌', label: 'Banana', keywords: ['banana', 'fruit', 'produce'] },
    { icon: 'mdi:fruit-grapes', emoji: '🍇', label: 'Grapes', keywords: ['grapes', 'fruit', 'produce'] },
    { icon: 'mdi:fruit-watermelon', emoji: '🍉', label: 'Watermelon', keywords: ['watermelon', 'fruit', 'produce'] },
    { icon: 'mdi:fruit-cherries', emoji: '🍒', label: 'Cherries', keywords: ['cherries', 'fruit', 'produce'] },
    { icon: 'mdi:fruit-pineapple', emoji: '🍍', label: 'Pineapple', keywords: ['pineapple', 'fruit', 'tropical'] },
    { icon: 'mdi:fruit-pear', emoji: '🍐', label: 'Pear', keywords: ['pear', 'fruit'] },
    { icon: 'mdi:food-kiwi', emoji: '🥝', label: 'Kiwi', keywords: ['kiwi', 'fruit'] },
    { icon: 'mdi:fruit-citrus', emoji: '🍊', label: 'Orange', keywords: ['orange', 'citrus', 'fruit'] },
    { icon: 'mdi:fruit-grapes-outline', emoji: '🍇', label: 'Grapes Outline', keywords: ['grapes', 'fruit'] },
    
    // Vegetables - Material Design Icons
    { icon: 'mdi:carrot', emoji: '🥕', label: 'Carrot', keywords: ['carrot', 'vegetable', 'produce'] },
    { icon: 'mdi:corn', emoji: '🌽', label: 'Corn', keywords: ['corn', 'vegetable'] },
    { icon: 'mdi:food-corn', emoji: '🌽', label: 'Corn Alt', keywords: ['corn', 'vegetable'] },
    { icon: 'mdi:food-pepper', emoji: '🫑', label: 'Pepper', keywords: ['pepper', 'vegetable', 'spice'] },
    { icon: 'mdi:food-onion', emoji: '🧅', label: 'Onion', keywords: ['onion', 'aromatic'] },
    { icon: 'mdi:garlic', emoji: '🧄', label: 'Garlic', keywords: ['garlic', 'aromatic'] },
    { icon: 'mdi:mushroom', emoji: '🍄', label: 'Mushroom', keywords: ['mushroom', 'vegetable'] },
    { icon: 'mdi:food-variant-off', emoji: '🥬', label: 'Lettuce', keywords: ['lettuce', 'vegetable', 'greens'] },
    { icon: 'mdi:food-variant', emoji: '🥬', label: 'Vegetable', keywords: ['vegetable', 'greens'] },
    
    // Proteins - Material Design Icons
    { icon: 'mdi:food-drumstick', emoji: '🍗', label: 'Chicken', keywords: ['chicken', 'protein', 'meat'] },
    { icon: 'mdi:food-steak', emoji: '🥩', label: 'Steak', keywords: ['steak', 'beef', 'protein'] },
    { icon: 'mdi:fish', emoji: '🐟', label: 'Fish', keywords: ['fish', 'seafood', 'protein'] },
    { icon: 'mdi:food-turkey', emoji: '🦃', label: 'Turkey', keywords: ['turkey', 'protein', 'meat'] },
    { icon: 'mdi:food-egg', emoji: '🥚', label: 'Egg', keywords: ['egg', 'protein'] },
    { icon: 'mdi:egg-easter', emoji: '🥚', label: 'Egg (Decorated)', keywords: ['egg', 'protein'] },
    { icon: 'mdi:barbecue', emoji: '🍖', label: 'Barbecue', keywords: ['bbq', 'grill', 'meat'] },
    { icon: 'mdi:food-drumstick-outline', emoji: '🍗', label: 'Chicken Outline', keywords: ['chicken', 'protein'] },
    
    // Grains & Bread - Material Design Icons
    { icon: 'mdi:food-grains', emoji: '🌾', label: 'Grains', keywords: ['grains', 'wheat'] },
    { icon: 'mdi:rice', emoji: '🍚', label: 'Rice', keywords: ['rice', 'grain'] },
    { icon: 'mdi:bread-slice', emoji: '🍞', label: 'Bread Slice', keywords: ['bread', 'bakery'] },
    { icon: 'mdi:baguette', emoji: '🥖', label: 'Baguette', keywords: ['bread', 'baguette'] },
    { icon: 'mdi:pretzel', emoji: '🥨', label: 'Pretzel', keywords: ['pretzel', 'snack'] },
    { icon: 'mdi:food-croissant', emoji: '🥐', label: 'Croissant', keywords: ['croissant', 'pastry', 'bakery'] },
    { icon: 'mdi:noodles', emoji: '🍝', label: 'Noodles', keywords: ['noodles', 'pasta'] },
    { icon: 'mdi:pasta', emoji: '🍝', label: 'Pasta', keywords: ['pasta', 'italian'] },
    { icon: 'mdi:food-ramen', emoji: '🍜', label: 'Ramen', keywords: ['ramen', 'noodles'] },
    
    // Fast Food - Material Design Icons
    { icon: 'mdi:pizza', emoji: '🍕', label: 'Pizza', keywords: ['pizza', 'fastfood'] },
    { icon: 'mdi:hamburger', emoji: '🍔', label: 'Burger', keywords: ['burger', 'fastfood'] },
    { icon: 'mdi:food-hot-dog', emoji: '🌭', label: 'Hot Dog', keywords: ['hotdog', 'fastfood'] },
    { icon: 'mdi:food-burrito', emoji: '🌯', label: 'Burrito', keywords: ['burrito', 'wrap'] },
    { icon: 'mdi:food-taco', emoji: '🌮', label: 'Taco', keywords: ['taco', 'mexican'] },
    { icon: 'mdi:food-takeout-box', emoji: '🥡', label: 'Takeout', keywords: ['takeout', 'box', 'meal'] },
    
    // Desserts - Material Design Icons
    { icon: 'mdi:cupcake', emoji: '🧁', label: 'Cupcake', keywords: ['cupcake', 'dessert', 'sweet'] },
    { icon: 'mdi:cookie', emoji: '🍪', label: 'Cookie', keywords: ['cookie', 'dessert'] },
    { icon: 'mdi:cake-variant', emoji: '🍰', label: 'Cake', keywords: ['cake', 'dessert'] },
    { icon: 'mdi:cake', emoji: '🎂', label: 'Birthday Cake', keywords: ['cake', 'dessert', 'birthday'] },
    { icon: 'mdi:ice-cream', emoji: '🍦', label: 'Ice Cream', keywords: ['ice cream', 'dessert', 'frozen'] },
    
    // Drinks - Material Design Icons
    { icon: 'mdi:cup-water', emoji: '🥤', label: 'Water', keywords: ['water', 'drink'] },
    { icon: 'mdi:coffee', emoji: '☕️', label: 'Coffee', keywords: ['coffee', 'drink'] },
    { icon: 'mdi:coffee-outline', emoji: '☕️', label: 'Coffee Outline', keywords: ['coffee', 'drink'] },
    { icon: 'mdi:tea', emoji: '🍵', label: 'Tea', keywords: ['tea', 'drink'] },
    { icon: 'mdi:glass-cocktail', emoji: '🍸', label: 'Cocktail', keywords: ['cocktail', 'drink'] },
    { icon: 'mdi:beer', emoji: '🍺', label: 'Beer', keywords: ['beer', 'drink'] },
    { icon: 'mdi:bottle-wine', emoji: '🍷', label: 'Wine', keywords: ['wine', 'drink'] },
    { icon: 'mdi:bottle-soda', emoji: '🥤', label: 'Soda', keywords: ['soda', 'drink', 'pop'] },
    { icon: 'mdi:cup', emoji: '☕️', label: 'Cup', keywords: ['cup', 'drink'] },
    
    // Meals & Dishes - Material Design Icons
    { icon: 'mdi:food-variant', emoji: '🍽️', label: 'Meal', keywords: ['meal', 'plate', 'food'] },
    { icon: 'mdi:food-soup', emoji: '🍲', label: 'Soup', keywords: ['soup', 'stew', 'comfort'] },
    { icon: 'mdi:food-bowl', emoji: '🥣', label: 'Bowl', keywords: ['bowl', 'meal'] },
    { icon: 'mdi:food-fork-drink', emoji: '🍴', label: 'Utensils', keywords: ['utensils', 'fork', 'knife'] },
    
    // Fluent UI Icons
    { icon: 'fluent:food-grains-24-filled', emoji: '🌾', label: 'Grains Filled', keywords: ['grain', 'bread'] },
    { icon: 'fluent:food-pizza-24-filled', emoji: '🍕', label: 'Pizza Fluent', keywords: ['pizza', 'fastfood'] },
    { icon: 'fluent:drink-coffee-24-filled', emoji: '☕️', label: 'Coffee Fluent', keywords: ['coffee', 'drink'] },
    { icon: 'fluent:food-carrot-24-filled', emoji: '🥕', label: 'Carrot Fluent', keywords: ['carrot', 'vegetable'] },
    { icon: 'fluent:food-cake-24-filled', emoji: '🍰', label: 'Cake Fluent', keywords: ['cake', 'dessert'] },
    { icon: 'fluent:food-egg-24-filled', emoji: '🥚', label: 'Egg Fluent', keywords: ['egg', 'protein'] },
    { icon: 'fluent:food-apple-24-filled', emoji: '🍎', label: 'Apple Fluent', keywords: ['apple', 'fruit'] },
    { icon: 'fluent:food-fish-24-filled', emoji: '🐟', label: 'Fish Fluent', keywords: ['fish', 'seafood'] },
    { icon: 'fluent:drink-beer-24-filled', emoji: '🍺', label: 'Beer Fluent', keywords: ['beer', 'drink'] },
    { icon: 'fluent:drink-wine-24-filled', emoji: '🍷', label: 'Wine Fluent', keywords: ['wine', 'drink'] },
    
    // Carbon Icons
    { icon: 'carbon:apple', emoji: '🍎', label: 'Apple Carbon', keywords: ['apple', 'fruit'] },
    { icon: 'carbon:restaurant', emoji: '🍽️', label: 'Restaurant', keywords: ['restaurant', 'meal', 'food'] },
    { icon: 'carbon:restaurant-fine', emoji: '🍽️', label: 'Fine Dining', keywords: ['restaurant', 'dining'] },
    
    // Heroicons
    { icon: 'heroicons:cake-solid', emoji: '🍰', label: 'Cake Hero', keywords: ['cake', 'dessert'] },
    { icon: 'heroicons:beaker-solid', emoji: '🥤', label: 'Beaker', keywords: ['drink', 'beaker'] },
    
    // Font Awesome
    { icon: 'fa-solid:apple-alt', emoji: '🍎', label: 'Apple FA', keywords: ['apple', 'fruit'] },
    { icon: 'fa-solid:carrot', emoji: '🥕', label: 'Carrot FA', keywords: ['carrot', 'vegetable'] },
    { icon: 'fa-solid:fish', emoji: '🐟', label: 'Fish FA', keywords: ['fish', 'seafood'] },
    { icon: 'fa-solid:cheese', emoji: '🧀', label: 'Cheese', keywords: ['cheese', 'dairy'] },
    { icon: 'fa-solid:bread-slice', emoji: '🍞', label: 'Bread FA', keywords: ['bread', 'bakery'] },
    { icon: 'fa-solid:ice-cream', emoji: '🍦', label: 'Ice Cream FA', keywords: ['ice cream', 'dessert'] },
    { icon: 'fa-solid:lemon', emoji: '🍋', label: 'Lemon', keywords: ['lemon', 'citrus', 'fruit'] },
    { icon: 'fa-solid:pepper-hot', emoji: '🌶️', label: 'Hot Pepper', keywords: ['pepper', 'spicy', 'hot'] },
    { icon: 'fa-solid:shrimp', emoji: '🦐', label: 'Shrimp', keywords: ['shrimp', 'seafood'] },
    { icon: 'fa-solid:utensils', emoji: '🍴', label: 'Utensils FA', keywords: ['utensils', 'fork', 'knife'] },
    
    // Bootstrap Icons
    { icon: 'bootstrap:apple', emoji: '🍎', label: 'Apple Bootstrap', keywords: ['apple', 'fruit'] },
    { icon: 'bootstrap:egg-fried', emoji: '🍳', label: 'Fried Egg', keywords: ['egg', 'fried', 'breakfast'] },
    { icon: 'bootstrap:cup-hot', emoji: '☕️', label: 'Hot Cup', keywords: ['coffee', 'hot', 'drink'] },
    
    // Lucide Icons
    { icon: 'lucide:apple', emoji: '🍎', label: 'Apple Lucide', keywords: ['apple', 'fruit'] },
    { icon: 'lucide:carrot', emoji: '🥕', label: 'Carrot Lucide', keywords: ['carrot', 'vegetable'] },
    { icon: 'lucide:fish', emoji: '🐟', label: 'Fish Lucide', keywords: ['fish', 'seafood'] },
    { icon: 'lucide:coffee', emoji: '☕️', label: 'Coffee Lucide', keywords: ['coffee', 'drink'] },
    { icon: 'lucide:chef-hat', emoji: '👨‍🍳', label: 'Chef Hat', keywords: ['chef', 'cooking'] },
    { icon: 'lucide:utensils-crossed', emoji: '🍴', label: 'Utensils Lucide', keywords: ['utensils', 'dining'] },
    
    // Twemoji (Emoji Icons)
    { icon: 'twemoji:grapes', emoji: '🍇', label: 'Emoji Grapes', keywords: ['grapes', 'fruit'] },
    { icon: 'twemoji:hot-dog', emoji: '🌭', label: 'Emoji Hot Dog', keywords: ['hotdog', 'fastfood'] },
    { icon: 'twemoji:hamburger', emoji: '🍔', label: 'Emoji Burger', keywords: ['burger'] },
    { icon: 'twemoji:shallow-pan-of-food', emoji: '🥘', label: 'Emoji Paella', keywords: ['meal', 'food'] },
    { icon: 'twemoji:teacup-without-handle', emoji: '🍵', label: 'Emoji Tea', keywords: ['tea', 'drink'] },
    { icon: 'twemoji:green-apple', emoji: '🍏', label: 'Green Apple', keywords: ['apple', 'green', 'fruit'] },
    { icon: 'twemoji:red-apple', emoji: '🍎', label: 'Red Apple', keywords: ['apple', 'red', 'fruit'] },
    { icon: 'twemoji:pear', emoji: '🍐', label: 'Emoji Pear', keywords: ['pear', 'fruit'] },
    { icon: 'twemoji:peach', emoji: '🍑', label: 'Peach', keywords: ['peach', 'fruit'] },
    { icon: 'twemoji:cherries', emoji: '🍒', label: 'Emoji Cherries', keywords: ['cherries', 'fruit'] },
    { icon: 'twemoji:strawberry', emoji: '🍓', label: 'Strawberry', keywords: ['strawberry', 'fruit'] },
    { icon: 'twemoji:kiwi-fruit', emoji: '🥝', label: 'Emoji Kiwi', keywords: ['kiwi', 'fruit'] },
    { icon: 'twemoji:tomato', emoji: '🍅', label: 'Tomato', keywords: ['tomato', 'vegetable', 'fruit'] },
    { icon: 'twemoji:coconut', emoji: '🥥', label: 'Coconut', keywords: ['coconut', 'fruit', 'tropical'] },
    { icon: 'twemoji:mango', emoji: '🥭', label: 'Mango', keywords: ['mango', 'fruit', 'tropical'] },
    { icon: 'twemoji:pineapple', emoji: '🍍', label: 'Emoji Pineapple', keywords: ['pineapple', 'fruit'] },
    { icon: 'twemoji:watermelon', emoji: '🍉', label: 'Emoji Watermelon', keywords: ['watermelon', 'fruit'] },
    { icon: 'twemoji:tangerine', emoji: '🍊', label: 'Tangerine', keywords: ['tangerine', 'orange', 'citrus'] },
    { icon: 'twemoji:lemon', emoji: '🍋', label: 'Lemon Emoji', keywords: ['lemon', 'citrus'] },
    { icon: 'twemoji:banana', emoji: '🍌', label: 'Emoji Banana', keywords: ['banana', 'fruit'] },
    { icon: 'twemoji:carrot', emoji: '🥕', label: 'Emoji Carrot', keywords: ['carrot', 'vegetable'] },
    { icon: 'twemoji:corn-on-the-cob', emoji: '🌽', label: 'Emoji Corn', keywords: ['corn', 'vegetable'] },
    { icon: 'twemoji:hot-pepper', emoji: '🌶️', label: 'Hot Pepper Emoji', keywords: ['pepper', 'spicy', 'hot'] },
    { icon: 'twemoji:cucumber', emoji: '🥒', label: 'Cucumber', keywords: ['cucumber', 'vegetable'] },
    { icon: 'twemoji:leafy-green', emoji: '🥬', label: 'Leafy Greens', keywords: ['lettuce', 'greens', 'vegetable'] },
    { icon: 'twemoji:broccoli', emoji: '🥦', label: 'Broccoli', keywords: ['broccoli', 'vegetable'] },
    { icon: 'twemoji:garlic', emoji: '🧄', label: 'Emoji Garlic', keywords: ['garlic', 'aromatic'] },
    { icon: 'twemoji:onion', emoji: '🧅', label: 'Emoji Onion', keywords: ['onion', 'aromatic'] },
    { icon: 'twemoji:mushroom', emoji: '🍄', label: 'Emoji Mushroom', keywords: ['mushroom', 'vegetable'] },
    { icon: 'twemoji:peanuts', emoji: '🥜', label: 'Peanuts', keywords: ['peanuts', 'nuts', 'snack'] },
    { icon: 'twemoji:bread', emoji: '🍞', label: 'Emoji Bread', keywords: ['bread', 'bakery'] },
    { icon: 'twemoji:croissant', emoji: '🥐', label: 'Emoji Croissant', keywords: ['croissant', 'pastry'] },
    { icon: 'twemoji:baguette-bread', emoji: '🥖', label: 'Emoji Baguette', keywords: ['baguette', 'bread'] },
    { icon: 'twemoji:pretzel', emoji: '🥨', label: 'Emoji Pretzel', keywords: ['pretzel', 'snack'] },
    { icon: 'twemoji:cheese-wedge', emoji: '🧀', label: 'Cheese', keywords: ['cheese', 'dairy'] },
    { icon: 'twemoji:meat-on-bone', emoji: '🍖', label: 'Meat on Bone', keywords: ['meat', 'bone', 'protein'] },
    { icon: 'twemoji:poultry-leg', emoji: '🍗', label: 'Chicken Leg', keywords: ['chicken', 'leg', 'protein'] },
    { icon: 'twemoji:cut-of-meat', emoji: '🥩', label: 'Cut of Meat', keywords: ['meat', 'steak', 'protein'] },
    { icon: 'twemoji:bacon', emoji: '🥓', label: 'Bacon', keywords: ['bacon', 'meat', 'breakfast'] },
    { icon: 'twemoji:hamburger', emoji: '🍔', label: 'Emoji Hamburger', keywords: ['hamburger', 'burger', 'fastfood'] },
    { icon: 'twemoji:french-fries', emoji: '🍟', label: 'French Fries', keywords: ['fries', 'potato', 'fastfood'] },
    { icon: 'twemoji:pizza', emoji: '🍕', label: 'Emoji Pizza', keywords: ['pizza', 'fastfood'] },
    { icon: 'twemoji:hot-dog', emoji: '🌭', label: 'Emoji Hot Dog', keywords: ['hotdog', 'fastfood'] },
    { icon: 'twemoji:sandwich', emoji: '🥪', label: 'Sandwich', keywords: ['sandwich', 'lunch'] },
    { icon: 'twemoji:taco', emoji: '🌮', label: 'Emoji Taco', keywords: ['taco', 'mexican'] },
    { icon: 'twemoji:burrito', emoji: '🌯', label: 'Emoji Burrito', keywords: ['burrito', 'mexican', 'wrap'] },
    { icon: 'twemoji:tamale', emoji: '🫔', label: 'Tamale', keywords: ['tamale', 'mexican'] },
    { icon: 'twemoji:stuffed-flatbread', emoji: '🥙', label: 'Stuffed Flatbread', keywords: ['flatbread', 'wrap'] },
    { icon: 'twemoji:falafel', emoji: '🧆', label: 'Falafel', keywords: ['falafel', 'middle eastern'] },
    { icon: 'twemoji:egg', emoji: '🥚', label: 'Emoji Egg', keywords: ['egg', 'protein'] },
    { icon: 'twemoji:cooking', emoji: '🍳', label: 'Cooking', keywords: ['cooking', 'pan', 'breakfast'] },
    { icon: 'twemoji:shallow-pan-of-food', emoji: '🥘', label: 'Shallow Pan', keywords: ['pan', 'food', 'cooking'] },
    { icon: 'twemoji:pot-of-food', emoji: '🍲', label: 'Pot of Food', keywords: ['pot', 'soup', 'stew'] },
    { icon: 'twemoji:fondue', emoji: '🫕', label: 'Fondue', keywords: ['fondue', 'cheese'] },
    { icon: 'twemoji:bowl-with-spoon', emoji: '🥣', label: 'Bowl with Spoon', keywords: ['bowl', 'spoon', 'meal'] },
    { icon: 'twemoji:green-salad', emoji: '🥗', label: 'Green Salad', keywords: ['salad', 'greens', 'healthy'] },
    { icon: 'twemoji:popcorn', emoji: '🍿', label: 'Popcorn', keywords: ['popcorn', 'snack', 'movie'] },
    { icon: 'twemoji:butter', emoji: '🧈', label: 'Butter', keywords: ['butter', 'dairy'] },
    { icon: 'twemoji:salt', emoji: '🧂', label: 'Salt', keywords: ['salt', 'seasoning'] },
    { icon: 'twemoji:canned-food', emoji: '🥫', label: 'Canned Food', keywords: ['canned', 'food'] },
    { icon: 'twemoji:bento-box', emoji: '🍱', label: 'Bento Box', keywords: ['bento', 'japanese', 'lunch'] },
    { icon: 'twemoji:rice-cracker', emoji: '🍘', label: 'Rice Cracker', keywords: ['rice', 'cracker', 'snack'] },
    { icon: 'twemoji:rice-ball', emoji: '🍙', label: 'Rice Ball', keywords: ['rice', 'ball', 'japanese'] },
    { icon: 'twemoji:cooked-rice', emoji: '🍚', label: 'Cooked Rice', keywords: ['rice', 'cooked', 'grain'] },
    { icon: 'twemoji:curry-rice', emoji: '🍛', label: 'Curry Rice', keywords: ['curry', 'rice', 'indian'] },
    { icon: 'twemoji:steaming-bowl', emoji: '🍜', label: 'Steaming Bowl', keywords: ['noodles', 'ramen', 'soup'] },
    { icon: 'twemoji:spaghetti', emoji: '🍝', label: 'Spaghetti', keywords: ['spaghetti', 'pasta', 'italian'] },
    { icon: 'twemoji:roasted-sweet-potato', emoji: '🍠', label: 'Sweet Potato', keywords: ['sweet potato', 'roasted'] },
    { icon: 'twemoji:oden', emoji: '🍢', label: 'Oden', keywords: ['oden', 'japanese'] },
    { icon: 'twemoji:sushi', emoji: '🍣', label: 'Sushi', keywords: ['sushi', 'japanese', 'seafood'] },
    { icon: 'twemoji:fried-shrimp', emoji: '🍤', label: 'Fried Shrimp', keywords: ['shrimp', 'fried', 'seafood'] },
    { icon: 'twemoji:fish-cake-with-swirl', emoji: '🍥', label: 'Fish Cake', keywords: ['fish', 'cake', 'japanese'] },
    { icon: 'twemoji:moon-cake', emoji: '🥮', label: 'Moon Cake', keywords: ['moon cake', 'chinese', 'dessert'] },
    { icon: 'twemoji:dango', emoji: '🍡', label: 'Dango', keywords: ['dango', 'japanese', 'dessert'] },
    { icon: 'twemoji:dumpling', emoji: '🥟', label: 'Dumpling', keywords: ['dumpling', 'chinese'] },
    { icon: 'twemoji:fortune-cookie', emoji: '🥠', label: 'Fortune Cookie', keywords: ['fortune cookie', 'chinese'] },
    { icon: 'twemoji:takeout-box', emoji: '🥡', label: 'Takeout Box', keywords: ['takeout', 'box', 'chinese'] },
    { icon: 'twemoji:crab', emoji: '🦀', label: 'Crab', keywords: ['crab', 'seafood'] },
    { icon: 'twemoji:lobster', emoji: '🦞', label: 'Lobster', keywords: ['lobster', 'seafood'] },
    { icon: 'twemoji:shrimp', emoji: '🦐', label: 'Shrimp', keywords: ['shrimp', 'seafood'] },
    { icon: 'twemoji:squid', emoji: '🦑', label: 'Squid', keywords: ['squid', 'seafood'] },
    { icon: 'twemoji:oyster', emoji: '🦪', label: 'Oyster', keywords: ['oyster', 'seafood'] },
    { icon: 'twemoji:soft-ice-cream', emoji: '🍦', label: 'Soft Ice Cream', keywords: ['ice cream', 'soft', 'dessert'] },
    { icon: 'twemoji:shaved-ice', emoji: '🍧', label: 'Shaved Ice', keywords: ['shaved ice', 'dessert'] },
    { icon: 'twemoji:ice-cream', emoji: '🍨', label: 'Ice Cream', keywords: ['ice cream', 'dessert'] },
    { icon: 'twemoji:doughnut', emoji: '🍩', label: 'Doughnut', keywords: ['doughnut', 'donut', 'dessert'] },
    { icon: 'twemoji:cookie', emoji: '🍪', label: 'Emoji Cookie', keywords: ['cookie', 'dessert'] },
    { icon: 'twemoji:birthday-cake', emoji: '🎂', label: 'Birthday Cake', keywords: ['birthday', 'cake', 'dessert'] },
    { icon: 'twemoji:shortcake', emoji: '🍰', label: 'Shortcake', keywords: ['cake', 'shortcake', 'dessert'] },
    { icon: 'twemoji:cupcake', emoji: '🧁', label: 'Emoji Cupcake', keywords: ['cupcake', 'dessert'] },
    { icon: 'twemoji:pie', emoji: '🥧', label: 'Pie', keywords: ['pie', 'dessert'] },
    { icon: 'twemoji:chocolate-bar', emoji: '🍫', label: 'Chocolate Bar', keywords: ['chocolate', 'candy', 'dessert'] },
    { icon: 'twemoji:candy', emoji: '🍬', label: 'Candy', keywords: ['candy', 'sweet'] },
    { icon: 'twemoji:lollipop', emoji: '🍭', label: 'Lollipop', keywords: ['lollipop', 'candy'] },
    { icon: 'twemoji:custard', emoji: '🍮', label: 'Custard', keywords: ['custard', 'dessert'] },
    { icon: 'twemoji:honey-pot', emoji: '🍯', label: 'Honey Pot', keywords: ['honey', 'sweetener'] },
    { icon: 'twemoji:baby-bottle', emoji: '🍼', label: 'Baby Bottle', keywords: ['baby', 'bottle', 'milk'] },
    { icon: 'twemoji:glass-of-milk', emoji: '🥛', label: 'Glass of Milk', keywords: ['milk', 'dairy', 'drink'] },
    { icon: 'twemoji:hot-beverage', emoji: '☕', label: 'Hot Beverage', keywords: ['coffee', 'tea', 'hot', 'drink'] },
    { icon: 'twemoji:teapot', emoji: '🫖', label: 'Teapot', keywords: ['teapot', 'tea'] },
    { icon: 'twemoji:teacup-without-handle', emoji: '🍵', label: 'Teacup', keywords: ['tea', 'cup', 'drink'] },
    { icon: 'twemoji:sake', emoji: '🍶', label: 'Sake', keywords: ['sake', 'japanese', 'drink'] },
    { icon: 'twemoji:bottle-with-popping-cork', emoji: '🍾', label: 'Champagne', keywords: ['champagne', 'wine', 'drink'] },
    { icon: 'twemoji:wine-glass', emoji: '🍷', label: 'Wine Glass', keywords: ['wine', 'glass', 'drink'] },
    { icon: 'twemoji:cocktail-glass', emoji: '🍸', label: 'Cocktail Glass', keywords: ['cocktail', 'drink'] },
    { icon: 'twemoji:tropical-drink', emoji: '🍹', label: 'Tropical Drink', keywords: ['tropical', 'drink', 'cocktail'] },
    { icon: 'twemoji:beer-mug', emoji: '🍺', label: 'Beer Mug', keywords: ['beer', 'mug', 'drink'] },
    { icon: 'twemoji:clinking-beer-mugs', emoji: '🍻', label: 'Clinking Beer Mugs', keywords: ['beer', 'cheers', 'drink'] },
    { icon: 'twemoji:clinking-glasses', emoji: '🥂', label: 'Clinking Glasses', keywords: ['champagne', 'cheers', 'drink'] },
    { icon: 'twemoji:tumbler-glass', emoji: '🥃', label: 'Tumbler Glass', keywords: ['whiskey', 'glass', 'drink'] },
    { icon: 'twemoji:pouring-liquid', emoji: '🫗', label: 'Pouring Liquid', keywords: ['pour', 'liquid', 'drink'] },
    { icon: 'twemoji:cup-with-straw', emoji: '🥤', label: 'Cup with Straw', keywords: ['cup', 'straw', 'drink'] },
    { icon: 'twemoji:bubble-tea', emoji: '🧋', label: 'Bubble Tea', keywords: ['bubble tea', 'boba', 'drink'] },
    { icon: 'twemoji:mate', emoji: '🧉', label: 'Mate', keywords: ['mate', 'drink', 'tea'] },
    { icon: 'twemoji:ice', emoji: '🧊', label: 'Ice', keywords: ['ice', 'cold'] }
].map((item) => ({
    ...item,
    value: `iconify:${item.icon}`,
    search: `${item.label} ${item.keywords.join(' ')} ${item.icon}`.toLowerCase()
}));

function findIconDefinition(iconValue) {
    const normalized = (iconValue || '').trim();
    if (!normalized) {
        return null;
    }
    return ICONIFY_FOOD_ICONS.find((item) => item.value === normalized) || null;
}

let emojiPickerInitialized = false;
let emojiPickerFilter = '';

function filterEmojiOptions(term) {
    const normalized = (term || '').trim().toLowerCase();
    if (!normalized) {
        return ICONIFY_FOOD_ICONS;
    }
    return ICONIFY_FOOD_ICONS.filter((item) => item.search.includes(normalized));
}

function ensureEmojiPickerPanel() {
    if (!emojiPickerPanel || emojiPickerInitialized) {
        return;
    }

    emojiPickerPanel.innerHTML = '';

    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'emoji-picker-search';

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Search food emojis...';
    searchInput.setAttribute('aria-label', 'Search emojis');
    searchInput.autocomplete = 'off';
    searchWrapper.appendChild(searchInput);

    const grid = document.createElement('div');
    grid.className = 'emoji-picker-grid';
    grid.dataset.role = 'emoji-grid';

    const emptyState = document.createElement('div');
    emptyState.className = 'emoji-picker-empty';
    emptyState.dataset.role = 'emoji-empty';
    emptyState.hidden = true;

    emojiPickerPanel.appendChild(searchWrapper);
    emojiPickerPanel.appendChild(grid);
    emojiPickerPanel.appendChild(emptyState);

    searchInput.addEventListener('input', (event) => {
        emojiPickerFilter = event.target.value;
        renderEmojiResults(emojiPickerFilter);
    });

    emojiPickerInitialized = true;
    renderEmojiResults('');
}

function renderEmojiResults(term) {
    if (!emojiPickerPanel) return;
    const grid = emojiPickerPanel.querySelector('[data-role="emoji-grid"]');
    const emptyState = emojiPickerPanel.querySelector('[data-role="emoji-empty"]');
    if (!grid || !emptyState) return;

    const results = filterEmojiOptions(term);
    grid.innerHTML = '';

    if (results.length === 0) {
        emptyState.textContent = 'No emojis match your search.';
        emptyState.hidden = false;
        grid.hidden = true;
        return;
    }

    emptyState.hidden = true;
    grid.hidden = false;

    results.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'emoji-picker-option';
        button.innerHTML = `<span class="iconify" data-icon="${item.icon}" aria-hidden="true"></span>`;
        button.title = item.label;
        button.dataset.iconify = item.value;
        button.addEventListener('click', async () => {
            await applyIconSelection(item);
        });
        grid.appendChild(button);
    });
    ensureIconify().then(() => scanIconifyElements(grid));
}

function openEmojiPicker(anchor = emojiPickerToggle || emojiInput) {
    if (!emojiPickerPanel) return;
    ensureEmojiPickerPanel();
    emojiPickerPanel.hidden = false;
    const searchInput = emojiPickerPanel.querySelector('input[type="search"]');
    if (searchInput) {
        searchInput.value = '';
        emojiPickerFilter = '';
        renderEmojiResults('');
        setTimeout(() => {
            searchInput.focus({ preventScroll: true });
        }, 10);
    }
}

function closeEmojiPicker() {
    if (!emojiPickerPanel) return;
    emojiPickerPanel.hidden = true;
}

function toggleEmojiPicker(anchor = emojiPickerToggle || emojiInput) {
    if (!emojiPickerPanel) return;
    if (emojiPickerPanel.hidden) {
        openEmojiPicker(anchor);
    } else {
        closeEmojiPicker();
    }
}

async function applyIconSelection(selectedItem) {
    if (!emojiInput) return;
    const normalizedEmoji = normalizeIconValue(selectedItem?.emoji);
    const iconifyValue = selectedItem?.value || '';
    
    // Convert Iconify icon to image data URL
    let iconDataUrl = null;
    if (iconifyValue && iconifyValue.startsWith('iconify:')) {
        const iconName = iconifyValue.slice('iconify:'.length);
        try {
            iconDataUrl = await iconifyToDataUrl(iconName);
            if (iconDataUrl) {
                console.log('Icon converted to data URL:', iconName);
            } else {
                console.warn('Failed to convert icon to data URL, keeping iconify reference');
            }
        } catch (error) {
            console.error('Error converting icon to data URL:', error);
        }
    }
    
    // Store the icon value (prefer data URL, fallback to iconify reference)
    selectedIconValue = iconDataUrl || iconifyValue || '';
    
    // Store the icon value in the input's dataset so it persists even if user types
    emojiInput.value = normalizedEmoji;
    emojiInput.dataset.iconifyValue = selectedIconValue;
    emojiInput.dataset.iconifyLabel = selectedItem?.label || '';
    console.log('Icon selected:', { 
        icon: selectedIconValue, 
        emoji: normalizedEmoji, 
        label: selectedItem?.label,
        isDataUrl: isDataUrl(selectedIconValue)
    });
    closeEmojiPicker();
    emojiInput.focus();
}

// DOM Elements
const form = document.getElementById('custom-ingredient-form');
const ingredientsList = document.getElementById('custom-ingredients-list');
const searchInput = document.getElementById('ingredient-search');
const emojiInput = document.getElementById('ingredient-emoji');
const emojiPickerToggle = document.getElementById('emoji-picker-toggle');
const emojiPickerPanel = document.getElementById('emoji-picker-panel');

if (emojiPickerToggle) {
    void ensureEmojiPickerPanel();
}
const addIngredientBtn = document.getElementById('add-ingredient-btn');
const ingredientModal = document.getElementById('ingredient-modal');
const cancelIngredientBtn = document.getElementById('cancel-ingredient');
const closeModalBtn = ingredientModal.querySelector('.close');

// CSV Upload/Download DOM Elements
const downloadCsvTemplateBtn = document.getElementById('download-csv-template-btn');
const uploadCsvBtn = document.getElementById('upload-csv-btn');
const uploadCsvModal = document.getElementById('upload-csv-modal');
const uploadCsvForm = document.getElementById('upload-csv-form');
const csvFileInput = document.getElementById('csv-file-input');
const csvUploadProgress = document.getElementById('csv-upload-progress');
const csvUploadError = document.getElementById('csv-upload-error');
const csvUploadResults = document.getElementById('csv-upload-results');
const csvUploadSummary = document.getElementById('csv-upload-summary');
const csvCloseBtn = uploadCsvModal ? uploadCsvModal.querySelector('.csv-close') : null;
const cancelCsvUploadBtn = document.getElementById('cancel-csv-upload');

// Migrate old localStorage key to new key
function migrateIngredientsStorage() {
    try {
        const oldKey = 'meale-custom-ingredients';
        const newKey = 'meale-my-ingredients';
        const oldData = localStorage.getItem(oldKey);
        const newData = localStorage.getItem(newKey);
        
        // If new key doesn't exist but old key does, migrate
        if (!newData && oldData) {
            console.log('Migrating ingredients from old storage key to new key...');
            localStorage.setItem(newKey, oldData);
            localStorage.removeItem(oldKey);
            console.log('Migration complete');
        }
    } catch (error) {
        console.error('Error migrating ingredients storage:', error);
    }
}

// Load my ingredients from localStorage
function loadCustomIngredients() {
    try {
        // Migrate old storage key if needed
        migrateIngredientsStorage();
        
        console.log('Loading my ingredients...');
        const savedIngredients = localStorage.getItem('meale-my-ingredients');
        if (savedIngredients) {
            customIngredients = JSON.parse(savedIngredients).map(ingredient => {
                const iconValue = typeof ingredient.icon === 'string' ? ingredient.icon.trim() : '';
                const iconDef = findIconDefinition(iconValue);
                const fallbackEmoji = iconDef?.emoji || ingredient.emoji;
                return {
                ...ingredient,
                storeSection: ingredient.storeSection || '',
                    emoji: normalizeIconValue(fallbackEmoji),
                    icon: iconValue,
                    iconLabel: ingredient.iconLabel || iconDef?.label || ''
                };
            });
            console.log('Loaded my ingredients:', customIngredients.length);
        } else {
            console.log('No my ingredients found');
        }
        renderIngredientsList();
    } catch (error) {
        console.error('Error loading my ingredients:', error);
    }
}

// Save my ingredients to localStorage
function saveCustomIngredients() {
    try {
        console.log('Saving my ingredients...');
        localStorage.setItem('meale-my-ingredients', JSON.stringify(customIngredients));
        // Make ingredients available globally
        window.customIngredients = customIngredients;
        window.myIngredients = customIngredients; // Also expose as myIngredients for clarity
        console.log('Saved my ingredients:', customIngredients.length);
    } catch (error) {
        console.error('Error saving my ingredients:', error);
    }
}

// Open modal for adding/editing ingredient
function openIngredientModal(ingredient = null) {
    editingIngredientId = ingredient ? ingredient.id : null;
    
    // Reset form
    form.reset();
    
    // Set form title
    const modalTitle = ingredientModal.querySelector('h2');
    modalTitle.textContent = ingredient ? 'Edit Ingredient' : 'Add New Ingredient';
    
    // Fill form if editing
    const storeSectionInput = document.getElementById('store-section');

    if (ingredient) {
        document.getElementById('ingredient-name').value = ingredient.name || '';
        document.getElementById('total-price').value = ingredient.totalPrice || '';
        document.getElementById('total-weight').value = ingredient.totalWeight || '';
        document.getElementById('serving-size').value = ingredient.servingSize || 100;
        const nutrition = ingredient.nutrition || { calories: 0, fat: 0, carbs: 0, protein: 0 };
        document.getElementById('calories').value = Math.round(nutrition.calories || 0);
        document.getElementById('fat').value = nutrition.fat || 0;
        document.getElementById('carbs').value = nutrition.carbs || 0;
        document.getElementById('protein').value = nutrition.protein || 0;
        if (storeSectionInput) {
            storeSectionInput.value = ingredient.storeSection || '';
        }
        if (emojiInput) {
            const normalized = normalizeIconValue(ingredient.emoji);
            const iconValue = typeof ingredient.icon === 'string' ? ingredient.icon.trim() : '';
            const iconDef = findIconDefinition(iconValue);
            selectedIconValue = iconValue;
            emojiInput.value = normalized;
            if (iconValue) {
                emojiInput.dataset.iconifyValue = iconValue;
                emojiInput.dataset.iconifyLabel = iconDef?.label || ingredient.iconLabel || '';
            } else {
                delete emojiInput.dataset.iconifyValue;
                delete emojiInput.dataset.iconifyLabel;
            }
        }
    } else {
        if (storeSectionInput) {
            storeSectionInput.value = '';
        }
        if (emojiInput) {
            emojiInput.value = '';
            delete emojiInput.dataset.iconifyValue;
            delete emojiInput.dataset.iconifyLabel;
        }
        selectedIconValue = '';
    }
    closeEmojiPicker();
    
    // Clear API search
    if (apiSearchInput) apiSearchInput.value = '';
    if (apiSearchResults) apiSearchResults.innerHTML = '';
    // Remove any success messages
    if (apiSearchSection) {
        const messages = apiSearchSection.querySelectorAll('p[style*="color: #27ae60"]');
        messages.forEach(msg => msg.remove());
    }
    
    // Show modal
    ingredientModal.classList.add('active');
}

// Close ingredient modal
function closeIngredientModal() {
    ingredientModal.classList.remove('active');
    editingIngredientId = null;
    form.reset();
    closeEmojiPicker();
    selectedIconValue = '';
    if (emojiInput) {
        delete emojiInput.dataset.iconifyValue;
        delete emojiInput.dataset.iconifyLabel;
    }
}

// Add or update custom ingredient
async function saveCustomIngredient(event) {
    try {
        event.preventDefault();
        console.log('Saving custom ingredient...');
        
        const storeSectionInput = document.getElementById('store-section');
        const normalizedEmoji = emojiInput ? normalizeIconValue(emojiInput.value) : '';
        // Prioritize icon from dataset (persists even if user types), then selectedIconValue
        let iconValue = emojiInput?.dataset.iconifyValue || selectedIconValue || '';
        const iconLabel = emojiInput?.dataset.iconifyLabel || '';
        
        // If icon is an iconify reference (not already a data URL), convert it to data URL
        if (iconValue && iconValue.startsWith('iconify:') && !isDataUrl(iconValue)) {
            const iconName = iconValue.slice('iconify:'.length);
            console.log('Converting iconify reference to data URL:', iconName);
            const dataUrl = await iconifyToDataUrl(iconName);
            if (dataUrl) {
                iconValue = dataUrl;
                console.log('Icon converted to data URL');
            } else {
                console.warn('Failed to convert icon to data URL, keeping iconify reference');
            }
        }
        
        console.log('Saving ingredient with icon:', { 
            iconValue: iconValue ? (isDataUrl(iconValue) ? 'data URL (length: ' + iconValue.length + ')' : iconValue) : 'none',
            iconLabel, 
            emoji: normalizedEmoji,
            isDataUrl: isDataUrl(iconValue)
        });
        
        const ingredient = {
            id: editingIngredientId || Date.now().toString(),
            name: document.getElementById('ingredient-name').value,
            totalPrice: parseFloat(document.getElementById('total-price').value),
            totalWeight: parseFloat(document.getElementById('total-weight').value),
            servingSize: parseFloat(document.getElementById('serving-size').value),
            nutrition: {
                calories: parseInt(document.getElementById('calories').value),
                fat: parseFloat(document.getElementById('fat').value),
                carbs: parseFloat(document.getElementById('carbs').value),
                protein: parseFloat(document.getElementById('protein').value)
            },
            isCustom: true,
            storeSection: storeSectionInput ? storeSectionInput.value.trim() : '',
            emoji: normalizedEmoji, // Fallback emoji
            icon: iconValue, // Primary: icon as data URL (e.g., "data:image/svg+xml;base64,...")
            iconLabel: iconLabel
        };
        
        // Calculate price per gram
        ingredient.pricePerGram = ingredient.totalPrice / ingredient.totalWeight;
        
        if (editingIngredientId) {
            // Update existing ingredient
            const index = customIngredients.findIndex(ing => ing.id === editingIngredientId);
            if (index !== -1) {
                customIngredients[index] = ingredient;
            }
        } else {
            // Add new ingredient
            customIngredients.push(ingredient);
        }
        
        saveCustomIngredients();
        
        // Only render ingredients list if we're on the ingredients page
        const ingredientsList = document.getElementById('custom-ingredients-list');
        if (ingredientsList) {
        renderIngredientsList();
        }
        
        closeIngredientModal();
        selectedIconValue = '';
        
        console.log('Saved ingredient:', ingredient);
        
        // Show success message and dispatch event for other pages to listen
        if (typeof showAlert !== 'undefined') {
            showAlert('Ingredient saved successfully! You can now search for it.', { type: 'success' });
        }
        
        // Dispatch custom event that recipes page can listen to
        window.dispatchEvent(new CustomEvent('ingredientSaved', { detail: { ingredient } }));
        
        // If we were editing a recipe, return to it
        if (window.returnToRecipeAfterIngredient) {
            window.returnToRecipeAfterIngredient = false;
            const recipeModal = document.getElementById('recipe-modal');
            if (recipeModal) {
                // Small delay to ensure modal closes first
                setTimeout(() => {
                    // Re-open the recipe modal
                    recipeModal.classList.add('active');
                    
                    // Focus back on the ingredient input that was being edited
                    if (window.lastEditedIngredientInput) {
                        const nameInput = window.lastEditedIngredientInput.querySelector('.ingredient-name');
                        if (nameInput) {
                            nameInput.focus();
                            // Trigger search again to show the new ingredient
                            const query = nameInput.value.trim();
                            if (query.length >= 2) {
                                setTimeout(() => {
                                    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                                }, 200);
                            }
                        }
                        window.lastEditedIngredientInput = null;
                    }
                }, 100);
            }
        }
    } catch (error) {
        console.error('Error saving custom ingredient:', error);
    }
}

// Delete custom ingredient
function deleteCustomIngredient(id) {
    try {
        console.log('Deleting custom ingredient:', id);
        customIngredients = customIngredients.filter(ing => ing.id !== id);
        saveCustomIngredients();
        renderIngredientsList();
    } catch (error) {
        console.error('Error deleting custom ingredient:', error);
    }
}

// Render ingredients list
function renderIngredientsList(filteredIngredients = null) {
    try {
        console.log('Rendering ingredients list...');
        const ingredients = filteredIngredients || customIngredients;
        const tbody = ingredientsList.querySelector('tbody');
        tbody.innerHTML = '';
        
        if (ingredients.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-items">No ingredients found</td>
                </tr>`;
            return;
        }
        
        ingredients.forEach(ingredient => {
            const row = document.createElement('tr');
            const iconSource = ingredient.icon || ingredient.emoji;
            // renderIcon now handles data URLs, iconify references, and emojis
            const iconMarkup = iconSource ? renderIcon(iconSource, { className: 'ingredient-icon', size: '24px' }) : '';
            const nameHTML = iconMarkup
                ? `${iconMarkup}<span class="ingredient-name-text">${ingredient.name}</span>`
                : `<span class="ingredient-name-text">${ingredient.name}</span>`;
            
            // Handle price and weight display - API ingredients might not have these
            const servingSize = ingredient.servingSize || 100;
            let priceDisplay = 'N/A';
            if (ingredient.totalPrice !== null && ingredient.totalPrice !== undefined && 
                ingredient.totalWeight !== null && ingredient.totalWeight !== undefined) {
                priceDisplay = `$${ingredient.totalPrice.toFixed(2)} (${ingredient.totalWeight}g)`;
            } else if (ingredient.pricePerGram !== null && ingredient.pricePerGram !== undefined) {
                // Calculate estimated price for 100g if we have price per gram
                const estimatedPrice = ingredient.pricePerGram * 100;
                priceDisplay = `~$${estimatedPrice.toFixed(2)}/100g`;
            }
            
            // Nutrition is stored per serving size, so display it correctly
            const nutrition = ingredient.nutrition || { calories: 0, fat: 0, carbs: 0, protein: 0 };
            const caloriesPerServing = Math.round(nutrition.calories || 0);
            const fatPerServing = (nutrition.fat || 0).toFixed(1);
            const carbsPerServing = (nutrition.carbs || 0).toFixed(1);
            const proteinPerServing = (nutrition.protein || 0).toFixed(1);
            
            // Add source indicator for API-sourced ingredients
            let sourceBadge = '';
            if (ingredient.source === 'usda' || ingredient.source === 'openfoodfacts') {
                const sourceLabel = ingredient.source === 'usda' ? 'USDA' : 'OFF';
                sourceBadge = `<span class="source-badge" title="Imported from ${sourceLabel}">${sourceLabel}</span>`;
            }
            
            row.innerHTML = `
                <td class="ingredient-name-cell">${nameHTML} ${sourceBadge}</td>
                <td>${ingredient.storeSection || 'Uncategorized'}</td>
                <td>${priceDisplay}</td>
                <td>${caloriesPerServing} <small>(${servingSize}g)</small></td>
                <td>
                    <div class="macro-info">
                        <span>F: ${fatPerServing}g</span>
                        <span>C: ${carbsPerServing}g</span>
                        <span>P: ${proteinPerServing}g</span>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-edit" onclick="editCustomIngredient('${ingredient.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-delete" onclick="deleteCustomIngredient('${ingredient.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
            scanIconifyElements(row);
        });
    } catch (error) {
        console.error('Error rendering ingredients list:', error);
    }
}

// Edit custom ingredient
function editCustomIngredient(id) {
    const ingredient = customIngredients.find(ing => ing.id === id);
    if (ingredient) {
        openIngredientModal(ingredient);
    }
}

// Search ingredients
function searchIngredients(event) {
    try {
        const searchTerm = event.target.value.toLowerCase();
        console.log('Searching ingredients:', searchTerm);
        
        const filteredIngredients = customIngredients.filter(ingredient =>
            ingredient.name.toLowerCase().includes(searchTerm)
        );
        
        renderIngredientsList(filteredIngredients);
    } catch (error) {
        console.error('Error searching ingredients:', error);
    }
}

// CSV Upload/Download Functionality

// CSV Template Download Function (must be defined outside conditional)
function downloadCsvTemplate() {
    const headers = [
        'name',
        'emoji',
        'storeSection',
        'totalPrice',
        'totalWeight',
        'servingSize',
        'calories',
        'fat',
        'carbs',
        'protein'
    ];
    
    const exampleRow = [
        'Chicken Breast',
        '🍗',
        'Meat',
        '8.99',
        '500',
        '100',
        '165',
        '3.6',
        '0',
        '31'
    ];
    
    const csvContent = [
        headers.join(','),
        exampleRow.join(','),
        '# Example: Add your ingredients below',
        '# All numeric values should be numbers (no units)',
        '# emoji and storeSection are optional'
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'ingredients-template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

if (downloadCsvTemplateBtn) {
    downloadCsvTemplateBtn.addEventListener('click', downloadCsvTemplate);
}

if (uploadCsvBtn && uploadCsvModal && uploadCsvForm) {
    // CSV Upload and Parse Function
    function parseCsvFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
                    
                    if (lines.length < 2) {
                        reject(new Error('CSV file must have at least a header row and one data row'));
                        return;
                    }
                    
                    // Parse CSV line handling quoted values
                    function parseCsvLine(line) {
                        const result = [];
                        let current = '';
                        let inQuotes = false;
                        
                        for (let i = 0; i < line.length; i++) {
                            const char = line[i];
                            if (char === '"') {
                                inQuotes = !inQuotes;
                            } else if (char === ',' && !inQuotes) {
                                result.push(current.trim());
                                current = '';
                            } else {
                                current += char;
                            }
                        }
                        result.push(current.trim());
                        return result;
                    }
                    
                    const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
                    const requiredHeaders = ['name', 'servingsize', 'calories', 'fat', 'carbs', 'protein'];
                    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
                    
                    if (missingHeaders.length > 0) {
                        reject(new Error(`Missing required columns: ${missingHeaders.join(', ')}`));
                        return;
                    }
                    
                    const ingredients = [];
                    for (let i = 1; i < lines.length; i++) {
                        const values = parseCsvLine(lines[i]);
                        if (values.length < headers.length) continue;
                        
                        const nameIndex = headers.indexOf('name');
                        const name = nameIndex >= 0 ? values[nameIndex] || '' : '';
                        
                        if (!name) continue; // Skip rows without a name
                        
                        const getValue = (headerName, defaultValue = '') => {
                            const index = headers.indexOf(headerName);
                            return index >= 0 ? (values[index] || defaultValue) : defaultValue;
                        };
                        
                        const ingredient = {
                            id: Date.now() + i,
                            name: name,
                            emoji: getValue('emoji', '').trim(),
                            storeSection: getValue('storesection', '').trim(),
                            totalPrice: parseFloat(getValue('totalprice', '0')) || null,
                            totalWeight: parseFloat(getValue('totalweight', '0')) || null,
                            servingSize: parseFloat(getValue('servingsize', '100')) || 100,
                            nutrition: {
                                calories: parseFloat(getValue('calories', '0')) || 0,
                                fat: parseFloat(getValue('fat', '0')) || 0,
                                carbs: parseFloat(getValue('carbs', '0')) || 0,
                                protein: parseFloat(getValue('protein', '0')) || 0
                            }
                        };
                        
                        ingredients.push(ingredient);
                    }
                    
                    if (ingredients.length === 0) {
                        reject(new Error('No valid ingredients found in CSV file'));
                        return;
                    }
                    
                    resolve(ingredients);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    
    // CSV Upload Modal Functions
    const openCsvUploadModal = () => {
        if (uploadCsvModal) {
            uploadCsvModal.style.display = 'block';
            uploadCsvModal.classList.add('active');
            if (csvFileInput) {
                csvFileInput.value = '';
            }
            if (csvUploadError) {
                csvUploadError.hidden = true;
                csvUploadError.textContent = '';
            }
            if (csvUploadResults) {
                csvUploadResults.hidden = true;
            }
            if (csvUploadProgress) {
                csvUploadProgress.hidden = true;
            }
        }
    };
    
    const closeCsvUploadModal = () => {
        if (uploadCsvModal) {
            uploadCsvModal.style.display = 'none';
            uploadCsvModal.classList.remove('active');
        }
        if (csvUploadProgress) {
            csvUploadProgress.hidden = true;
        }
    };
    
    const showCsvError = (message) => {
        if (csvUploadError) {
            csvUploadError.textContent = message;
            csvUploadError.hidden = false;
        }
        if (csvUploadResults) {
            csvUploadResults.hidden = true;
        }
    };
    
    const showCsvResults = (imported, skipped, errors) => {
        if (csvUploadResults && csvUploadSummary) {
            let summary = `Successfully imported ${imported} ingredient(s).`;
            if (skipped > 0) {
                summary += ` ${skipped} ingredient(s) skipped (duplicates or invalid data).`;
            }
            if (errors.length > 0) {
                summary += ` Errors: ${errors.join(', ')}`;
            }
            csvUploadSummary.textContent = summary;
            csvUploadResults.hidden = false;
        }
    };
    
    const handleCsvUpload = async (event) => {
        event.preventDefault();
        if (!csvFileInput || !csvFileInput.files || csvFileInput.files.length === 0) {
            showCsvError('Please select a CSV file');
            return;
        }
        
        const file = csvFileInput.files[0];
        if (csvUploadProgress) {
            csvUploadProgress.hidden = false;
        }
        if (csvUploadError) {
            csvUploadError.hidden = true;
        }
        
        try {
            const importedIngredients = await parseCsvFile(file);
            
            let imported = 0;
            let skipped = 0;
            const errors = [];
            
            importedIngredients.forEach(ingredient => {
                // Check for duplicates by name
                const existing = customIngredients.find(ci => 
                    ci.name.toLowerCase() === ingredient.name.toLowerCase()
                );
                
                if (existing) {
                    skipped++;
                } else {
                    customIngredients.push(ingredient);
                    imported++;
                }
            });
            
            if (imported > 0) {
                saveCustomIngredients();
                renderIngredientsList();
            }
            
            showCsvResults(imported, skipped, errors);
            
            // Auto-close after 3 seconds if successful
            if (imported > 0) {
                setTimeout(() => {
                    closeCsvUploadModal();
                }, 3000);
            }
        } catch (error) {
            console.error('CSV upload error:', error);
            showCsvError(error.message || 'Failed to process CSV file. Please check the format.');
        } finally {
            if (csvUploadProgress) {
                csvUploadProgress.hidden = true;
            }
        }
    };
    
    // Event Listeners
    uploadCsvBtn.addEventListener('click', openCsvUploadModal);
    uploadCsvForm.addEventListener('submit', handleCsvUpload);
    
    if (csvCloseBtn) {
        csvCloseBtn.addEventListener('click', closeCsvUploadModal);
    }
    
    if (cancelCsvUploadBtn) {
        cancelCsvUploadBtn.addEventListener('click', closeCsvUploadModal);
    }
    
    window.addEventListener('click', (event) => {
        if (event.target === uploadCsvModal) {
            closeCsvUploadModal();
        }
    });
    
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && uploadCsvModal && uploadCsvModal.classList.contains('active')) {
            closeCsvUploadModal();
        }
    });
}

// API Search Functionality
const apiSearchInput = document.getElementById('api-search-input');
const apiSearchBtn = document.getElementById('api-search-btn');
const apiSearchResults = document.getElementById('api-search-results');
const apiSearchSection = document.getElementById('api-search-section');

async function handleAPISearch() {
    const query = apiSearchInput?.value.trim();
    if (!query || query.length < 2) {
        if (apiSearchResults) {
            apiSearchResults.innerHTML = '<p style="color: #999; font-size: 0.9em;">Enter at least 2 characters to search</p>';
        }
        return;
    }
    
    if (!apiSearchResults) return;
    
    apiSearchResults.innerHTML = '<div class="loading-message"><i class="fas fa-spinner fa-spin"></i> Searching APIs...</div>';
    
    try {
        // Search both APIs in parallel
        const [usdaResults, offResults] = await Promise.allSettled([
            searchUSDAIngredients(query, 5),
            searchOpenFoodFactsIngredients(query, 5)
        ]);
        
        const results = [];
        
        // Process USDA results
        if (usdaResults.status === 'fulfilled' && usdaResults.value) {
            results.push(...usdaResults.value.map(r => ({ ...r, source: 'usda' })));
        }
        
        // Process Open Food Facts results
        if (offResults.status === 'fulfilled' && offResults.value) {
            results.push(...offResults.value.map(r => ({ ...r, source: 'openfoodfacts' })));
        }
        
        displayAPISearchResults(results);
    } catch (error) {
        console.error('Error searching APIs:', error);
        apiSearchResults.innerHTML = '<p style="color: var(--color-danger);">Error searching APIs. Please try again.</p>';
    }
}

function displayAPISearchResults(results) {
    if (!apiSearchResults) return;
    
    if (results.length === 0) {
        apiSearchResults.innerHTML = '<p>No results found. Try a different search term.</p>';
        return;
    }
    
    apiSearchResults.innerHTML = '';
    
    results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'api-search-result-item';
        
        const sourceIcon = result.source === 'usda' ? '🌾' : '🏷️';
        const sourceLabel = result.source === 'usda' ? 'USDA' : 'Open Food Facts';
        const nutrition = result.nutrition || {};
        const servingSize = result.servingSize || 100;
        
        // Convert per-gram nutrition to per-serving-size for display
        const caloriesPerServing = (nutrition.calories || 0) * servingSize;
        const proteinPerServing = (nutrition.protein || 0) * servingSize;
        const carbsPerServing = (nutrition.carbs || 0) * servingSize;
        const fatPerServing = (nutrition.fat || 0) * servingSize;
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <strong>${result.name}</strong>
                    <p>${sourceIcon} ${sourceLabel}</p>
                    <p>
                        Per ${servingSize}g: ${Math.round(caloriesPerServing)} cal, 
                        ${Math.round(proteinPerServing)}g protein, 
                        ${Math.round(carbsPerServing)}g carbs, 
                        ${Math.round(fatPerServing)}g fat
                    </p>
                </div>
            </div>
        `;
        
        div.addEventListener('click', () => {
            populateFormFromAPIResult(result);
        });
        
        apiSearchResults.appendChild(div);
    });
}

function populateFormFromAPIResult(result) {
    const nutrition = result.nutrition || {};
    const servingSize = result.servingSize || 100;
    
    // Convert per-gram nutrition to per-serving-size for form
    const caloriesPerServing = (nutrition.calories || 0) * servingSize;
    const proteinPerServing = (nutrition.protein || 0) * servingSize;
    const carbsPerServing = (nutrition.carbs || 0) * servingSize;
    const fatPerServing = (nutrition.fat || 0) * servingSize;
    
    // Populate form fields
    const nameInput = document.getElementById('ingredient-name');
    const servingSizeInput = document.getElementById('serving-size');
    const caloriesInput = document.getElementById('calories');
    const proteinInput = document.getElementById('protein');
    const carbsInput = document.getElementById('carbs');
    const fatInput = document.getElementById('fat');
    
    if (nameInput) nameInput.value = result.name || '';
    if (servingSizeInput) servingSizeInput.value = servingSize;
    if (caloriesInput) caloriesInput.value = Math.round(caloriesPerServing);
    if (proteinInput) proteinInput.value = Math.round(proteinPerServing * 10) / 10;
    if (carbsInput) carbsInput.value = Math.round(carbsPerServing * 10) / 10;
    if (fatInput) fatInput.value = Math.round(fatPerServing * 10) / 10;
    
    // Clear search results and input
    if (apiSearchResults) apiSearchResults.innerHTML = '';
    if (apiSearchInput) apiSearchInput.value = '';
    
    // Show success message
    if (apiSearchSection) {
        const successMsg = document.createElement('p');
        successMsg.style.cssText = 'color: var(--color-success); font-size: 0.9em; margin-top: var(--space-3);';
        successMsg.textContent = `✓ Filled form with data from ${result.source === 'usda' ? 'USDA' : 'Open Food Facts'}. Complete the remaining fields and save.`;
        apiSearchSection.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 5000);
    }
}

// Event Listeners
if (apiSearchBtn) {
    apiSearchBtn.addEventListener('click', handleAPISearch);
}

if (apiSearchInput) {
    apiSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAPISearch();
        }
    });
}

if (form) {
    form.addEventListener('submit', saveCustomIngredient);
    form.addEventListener('reset', closeEmojiPicker);
}
if (searchInput) {
    searchInput.addEventListener('input', searchIngredients);
}
if (addIngredientBtn) {
    addIngredientBtn.addEventListener('click', () => openIngredientModal());
}
if (cancelIngredientBtn) {
    cancelIngredientBtn.addEventListener('click', closeIngredientModal);
}
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeIngredientModal);
}

if (emojiInput) {
    emojiInput.addEventListener('focus', () => {
        void openEmojiPicker(emojiInput);
    });
    emojiInput.addEventListener('click', () => {
        void openEmojiPicker(emojiInput);
    });
    emojiInput.addEventListener('input', () => {
        const sanitized = normalizeIconValue(emojiInput.value);
        if (emojiInput.value !== sanitized) {
            emojiInput.value = sanitized;
        }
        selectedIconValue = '';
        delete emojiInput.dataset.iconifyValue;
        delete emojiInput.dataset.iconifyLabel;
    });
}

if (emojiPickerToggle) {
    emojiPickerToggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggleEmojiPicker(emojiPickerToggle);
    });
}

document.addEventListener('click', (event) => {
    if (!emojiPickerPanel || emojiPickerPanel.hidden) return;
    if (
        emojiPickerPanel.contains(event.target) ||
        (emojiPickerToggle && emojiPickerToggle.contains(event.target)) ||
        (emojiInput && emojiInput.contains(event.target))
    ) {
        return;
    }
    closeEmojiPicker();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && emojiPickerPanel && !emojiPickerPanel.hidden) {
        closeEmojiPicker();
    }
});

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === ingredientModal) {
        closeIngredientModal();
    }
});

// Make functions available globally
window.deleteCustomIngredient = deleteCustomIngredient;
window.editCustomIngredient = editCustomIngredient;
window.openIngredientModal = openIngredientModal;

// Initialize
loadCustomIngredients();
// Apply dark mode on page load
applyDarkMode(); 