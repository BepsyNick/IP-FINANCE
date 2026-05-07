const FINANCE_CATEGORIES = [
  {
    id: "groceries",
    name: "Продукты",
    icon: "shopping-cart",
  },
  {
    id: "restaurants",
    name: "Рестораны",
    icon: "utensils-crossed",
  },
  {
    id: "transport",
    name: "Транспорт",
    icon: "bus",
  },
  {
    id: "housing",
    name: "Жильё",
    icon: "house",
  },
  {
    id: "health",
    name: "Здоровье",
    icon: "heart-pulse",
  },
  {
    id: "clothes",
    name: "Одежда",
    icon: "shirt",
  },
  {
    id: "subscriptions",
    name: "Подписки",
    icon: "refresh-ccw",
  },
  {
    id: "entertainment",
    name: "Развлечения",
    icon: "gamepad-2",
  },
  {
    id: "travel",
    name: "Путешествия",
    icon: "plane",
  },
  {
    id: "other",
    name: "Другое",
    icon: "package",
  },
];

const LEGACY_CATEGORY_MAP = {
  food: "groceries",
  shopping: "other",
  home: "housing",
  fun: "entertainment",
  transport: "transport",
  other: "other",
};

function normalizeCategoryId(categoryId) {
  if (!categoryId) return "other";

  const directMatch = FINANCE_CATEGORIES.some(
    (category) => category.id === categoryId
  );

  if (directMatch) return categoryId;

  return LEGACY_CATEGORY_MAP[categoryId] || "other";
}

function getFinanceCategory(categoryId) {
  const normalizedId = normalizeCategoryId(categoryId);

  return (
    FINANCE_CATEGORIES.find((category) => category.id === normalizedId) ||
    FINANCE_CATEGORIES.find((category) => category.id === "other")
  );
}

const CATEGORY_IDS = FINANCE_CATEGORIES.map((category) => category.id);

if (typeof module !== "undefined") {
  module.exports = {
    FINANCE_CATEGORIES,
    CATEGORY_IDS,
    LEGACY_CATEGORY_MAP,
    normalizeCategoryId,
    getFinanceCategory,
  };
}

if (typeof window !== "undefined") {
  window.FINANCE_CATEGORIES = FINANCE_CATEGORIES;
  window.CATEGORY_IDS = CATEGORY_IDS;
  window.LEGACY_CATEGORY_MAP = LEGACY_CATEGORY_MAP;
  window.normalizeCategoryId = normalizeCategoryId;
  window.getFinanceCategory = getFinanceCategory;
}
