const APP_CONFIG = {
  apiUrl: "/api",
  sessionDurationMs: 60 * 60 * 1000,
  defaultBudget: 600,
  currency: "€",
  monthNames: [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ],
};

if (typeof module !== "undefined") {
  module.exports = { APP_CONFIG };
}

if (typeof window !== "undefined") {
  window.APP_CONFIG = APP_CONFIG;
}