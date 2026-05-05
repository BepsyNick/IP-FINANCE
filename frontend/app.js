const API_URL = "http://localhost:3000/api";

let currentUser = JSON.parse(localStorage.getItem("currentUser"));
let authToken = localStorage.getItem("authToken");
let loginTime = localStorage.getItem("loginTime");

let budget = 600;
let expenses = [];
let isRegisterMode = false;
let editingExpenseId = null;
let isLoggingOut = false;
let lastLimitWarningKey = null;
let pendingConfirmAction = null;

let expenseCategoryFilter = "all";
let expensePeriodFilter = "month";
let expenseSearchQuery = "";

// ===== MONTH PERIOD =====
const initialDate = new Date();

let selectedMonth = initialDate.getMonth() + 1;
let selectedYear = initialDate.getFullYear();

const MONTH_NAMES = [
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
];

function getPeriodQuery() {
  return `month=${selectedMonth}&year=${selectedYear}`;
}

function renderCurrentMonth() {
  const currentMonthLabel = document.getElementById("currentMonthLabel");

  if (currentMonthLabel) {
    currentMonthLabel.textContent = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
  }
}

// ===== ELEMENTS =====
const loginBtn = document.getElementById("loginBtn");
const loginScreen = document.getElementById("loginScreen");
const mainScreen = document.getElementById("mainScreen");

const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authSwitch = document.getElementById("authSwitch");

const overlay = document.getElementById("overlay");
const toast = document.getElementById("toast");

const addBtn = document.getElementById("addExpenseBtn");
const saveBudgetBtn = document.getElementById("saveBudgetBtn");
const expenseDateInput = document.getElementById("expenseDateInput");
const quickAmountButtons = document.querySelectorAll(".quick-amount-btn");

// Filter elements
const expenseCategoryFilterInput = document.getElementById("expenseCategoryFilter");
const expensePeriodFilterInput = document.getElementById("expensePeriodFilter");
const expenseSearchInput = document.getElementById("expenseSearchInput");
const resetExpenseFiltersBtn = document.getElementById("resetExpenseFiltersBtn");

// Settings elements
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const settingsLogin = document.getElementById("settingsLogin");
const settingsBudgetInput = document.getElementById("settingsBudgetInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const logoutBtn = document.getElementById("logoutBtn");
const currentPasswordInput = document.getElementById("currentPasswordInput");

// Edit expense elements
const editExpenseModal = document.getElementById("editExpenseModal");
const closeEditExpenseBtn = document.getElementById("closeEditExpenseBtn");
const editAmountInput = document.getElementById("editAmountInput");
const editCategoryInput = document.getElementById("editCategoryInput");
const editExpenseDateInput = document.getElementById("editExpenseDateInput");
const editCommentInput = document.getElementById("editCommentInput");
const saveEditExpenseBtn = document.getElementById("saveEditExpenseBtn");
const deleteEditExpenseBtn = document.getElementById("deleteEditExpenseBtn");

// Confirm elements
const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmMessage = document.getElementById("confirmMessage");
const cancelConfirmBtn = document.getElementById("cancelConfirmBtn");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const confirmActionBtn = document.getElementById("confirmActionBtn");

// Analytics elements
const analyticsTotalSpent = document.getElementById("analyticsTotalSpent");
const analyticsTodaySpent = document.getElementById("analyticsTodaySpent");
const analyticsTopCategory = document.getElementById("analyticsTopCategory");
const categoryStatsList = document.getElementById("categoryStatsList");

// ===== TOAST =====
let toastTimer = null;

function showToast(message, type = "success") {
  if (!toast) return;

  clearTimeout(toastTimer);

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 2600);
}

function expireSession(message = "Сессия истекла") {
  if (isLoggingOut) return;

  isLoggingOut = true;
  showToast(message, "error");

  setTimeout(() => {
    logout();
  }, 1200);
}

// ===== SESSION =====
const ONE_HOUR = 60 * 60 * 1000;

function openApp() {
  loginScreen.style.display = "none";
  mainScreen.classList.remove("blurred");

  const accountLogin = document.getElementById("accountLogin");

  if (accountLogin && currentUser) {
    accountLogin.textContent = currentUser.login;
  }
}

function logout() {
  localStorage.removeItem("currentUser");
  localStorage.removeItem("authToken");
  localStorage.removeItem("loginTime");

  currentUser = null;
  authToken = null;
  loginTime = null;

  location.reload();
}

function checkSession() {
  const savedUser = localStorage.getItem("currentUser");
  const savedToken = localStorage.getItem("authToken");
  const savedLoginTime = localStorage.getItem("loginTime");

  if (!savedUser || !savedToken || !savedLoginTime) return;

  const diff = Date.now() - Number(savedLoginTime);

  if (diff >= ONE_HOUR) {
    expireSession("Сессия истекла");
  }
}

function initSession() {
  if (!currentUser || !authToken || !loginTime) return;

  const diff = Date.now() - Number(loginTime);

  if (diff < ONE_HOUR) {
    openApp();
    loadData();
  } else {
    expireSession("Сессия истекла");
  }
}

setInterval(checkSession, 30000);

// ===== API =====
async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 || res.status === 403) {
    expireSession("Сессия истекла или доступ запрещён");
    throw new Error("Unauthorized");
  }

  return res;
}

// ===== AUTH MODE SWITCH =====
authSwitch.onclick = () => {
  isRegisterMode = !isRegisterMode;

  document.getElementById("loginInput").value = "";
  document.getElementById("passwordInput").value = "";

  if (isRegisterMode) {
    authTitle.textContent = "Создать аккаунт";
    authSubtitle.textContent = "Регистрация нового пользователя";
    loginBtn.textContent = "Зарегистрироваться";
    authSwitch.textContent = "Уже есть аккаунт? Войти";
  } else {
    authTitle.textContent = "Finance Control";
    authSubtitle.textContent = "Войти в аккаунт";
    loginBtn.textContent = "Войти";
    authSwitch.textContent = "Нет аккаунта? Зарегистрироваться";
  }
};

// ===== LOGIN / REGISTER =====
loginBtn.onclick = async () => {
  const login = document.getElementById("loginInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();

  if (!login || !password) {
    showToast("Введите логин и пароль", "error");
    return;
  }

  const endpoint = isRegisterMode ? "register" : "login";

  try {
    const res = await fetch(`${API_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ login, password }),
    });

    const data = await res.json();

    if (!data.success) {
      showToast(data.message || "Ошибка входа", "error");
      return;
    }

    currentUser = data.user;
    authToken = data.token;
    loginTime = Date.now();

    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    localStorage.setItem("authToken", authToken);
    localStorage.setItem("loginTime", loginTime);

    openApp();
    await loadData();

    showToast(isRegisterMode ? "Аккаунт создан" : "Вход выполнен");
  } catch (error) {
    console.error(error);
    showToast("Не удалось подключиться к серверу", "error");
  }
};

// ===== MODALS =====
function showOverlay() {
  overlay.classList.add("show");
}

function hideOverlay() {
  overlay.classList.remove("show");
}

function hasOpenMainModal() {
  return (
    settingsModal.classList.contains("open") ||
    editExpenseModal.classList.contains("open")
  );
}

function closeAllModals() {
  settingsModal.classList.remove("open");
  editExpenseModal.classList.remove("open");
  confirmModal.classList.remove("open");

  pendingConfirmAction = null;
  editingExpenseId = null;

  editAmountInput.value = "";
  editCommentInput.value = "";
  editExpenseDateInput.value = "";

  hideOverlay();
}

// ===== CONFIRM MODAL =====
function openConfirm({
  title = "Подтверждение",
  message = "Подтвердить действие?",
  confirmText = "Подтвердить",
  type = "danger",
  onConfirm,
}) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmActionBtn.textContent = confirmText;
  confirmActionBtn.className =
    type === "danger" ? "confirm-danger-btn" : "confirm-main-btn";

  pendingConfirmAction = onConfirm;

  confirmModal.classList.add("open");
  showOverlay();
}

function closeConfirm() {
  confirmModal.classList.remove("open");
  pendingConfirmAction = null;

  if (!hasOpenMainModal()) {
    hideOverlay();
  }
}

cancelConfirmBtn.onclick = closeConfirm;
confirmCancelBtn.onclick = closeConfirm;

confirmActionBtn.onclick = async () => {
  if (!pendingConfirmAction) return;

  const action = pendingConfirmAction;

  try {
    await action();
  } finally {
    closeConfirm();
  }
};

// ===== SETTINGS MODAL =====
function openSettings() {
  if (!currentUser) return;

  settingsLogin.textContent = currentUser.login;
  settingsBudgetInput.placeholder = `Текущий бюджет: ${budget} €`;

  settingsModal.classList.add("open");
  showOverlay();
}

function closeSettings() {
  settingsModal.classList.remove("open");
  hideOverlay();
}

settingsBtn.onclick = openSettings;
closeSettingsBtn.onclick = closeSettings;

logoutBtn.onclick = () => {
  openConfirm({
    title: "Выйти из аккаунта?",
    message: "После выхода нужно будет снова ввести логин и пароль.",
    confirmText: "Выйти",
    type: "danger",
    onConfirm: () => logout(),
  });
};

overlay.onclick = closeAllModals;

// ===== LOAD DATA =====
async function loadData() {
  if (!currentUser || !authToken) return;

  try {
    const budgetRes = await apiFetch(`/budget?${getPeriodQuery()}`);
    const budgetData = await budgetRes.json();

    const expensesRes = await apiFetch(`/expenses?${getPeriodQuery()}`);
    const expensesData = await expensesRes.json();

    budget = budgetData.monthlyAmount;
    expenses = expensesData.expenses || [];

    const budgetInput = document.getElementById("budgetInput");

    if (budgetInput) {
      budgetInput.placeholder = `Текущий бюджет: ${budget} €`;
    }

    renderCurrentMonth();
    render();
  } catch (error) {
    console.error(error);

    if (error.message !== "Unauthorized") {
      showToast("Ошибка загрузки данных", "error");
    }
  }
}

// ===== SAVE BUDGET FROM MAIN FORM =====
if (saveBudgetBtn) {
  saveBudgetBtn.onclick = async () => {
    if (!currentUser) return;

    const budgetInput = document.getElementById("budgetInput");
    const monthlyAmount = parseFloat(budgetInput.value);

    if (!monthlyAmount || monthlyAmount <= 0) {
      showToast("Бюджет должен быть больше 0", "error");
      return;
    }

    await updateBudget(monthlyAmount);

    budgetInput.value = "";

    await loadData();

    showToast("Бюджет сохранён");
    setTimeout(showDailyLimitWarningIfNeeded, 700);
  };
}

// ===== SAVE SETTINGS =====
saveSettingsBtn.onclick = async () => {
  if (!currentUser) return;

  const newBudgetRaw = settingsBudgetInput.value.trim();
  const currentPassword = currentPasswordInput.value.trim();
  const newPassword = document.getElementById("newPasswordInput").value.trim();
  const repeatPassword = document
    .getElementById("repeatPasswordInput")
    .value.trim();

  try {
    let changedSomething = false;

    if (newBudgetRaw !== "") {
      const newBudget = Number(newBudgetRaw);

      if (!Number.isFinite(newBudget) || newBudget <= 0) {
        showToast("Бюджет должен быть больше 0", "error");
        return;
      }

      await updateBudget(newBudget);
      changedSomething = true;
    }

    if (currentPassword || newPassword || repeatPassword) {
      if (!currentPassword) {
        showToast("Введите текущий пароль", "error");
        return;
      }

      if (newPassword.length < 4) {
        showToast("Пароль должен быть минимум 4 символа", "error");
        return;
      }

      if (newPassword !== repeatPassword) {
        showToast("Пароли не совпадают", "error");
        return;
      }

      const passwordRes = await apiFetch("/users/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const passwordData = await passwordRes.json();

      if (!passwordData.success) {
        showToast(passwordData.message || "Ошибка смены пароля", "error");
        return;
      }

      changedSomething = true;
    }

    settingsBudgetInput.value = "";
    currentPasswordInput.value = "";
    document.getElementById("newPasswordInput").value = "";
    document.getElementById("repeatPasswordInput").value = "";

    await loadData();
    closeSettings();

    if (changedSomething) {
      showToast("Настройки сохранены");
      setTimeout(showDailyLimitWarningIfNeeded, 700);
    } else {
      showToast("Нет изменений для сохранения", "warning");
    }
  } catch (error) {
    console.error(error);

    if (error.message !== "Unauthorized") {
      showToast("Ошибка сохранения настроек", "error");
    }
  }
};

async function updateBudget(monthlyAmount) {
  await apiFetch(`/budget?${getPeriodQuery()}`, {
    method: "PUT",
    body: JSON.stringify({ monthlyAmount }),
  });
}

// ===== ADD EXPENSE =====
function setDefaultExpenseDate() {
  if (!expenseDateInput) return;

  expenseDateInput.value = toDateInputValue(new Date());
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isDateInSelectedMonth(date) {
  return (
    date.getMonth() + 1 === selectedMonth &&
    date.getFullYear() === selectedYear
  );
}

quickAmountButtons.forEach((button) => {
  button.onclick = () => {
    const amountInput = document.getElementById("amountInput");
    const quickAmount = Number(button.dataset.amount);
    const currentAmount = Number(amountInput.value) || 0;

    amountInput.value = (currentAmount + quickAmount).toFixed(2);
    amountInput.focus();
  };
});

addBtn.onclick = async () => {
  if (!currentUser) return;

  const amount = parseFloat(document.getElementById("amountInput").value);
  const category = document.getElementById("categoryInput").value;
  const comment = document.getElementById("commentInput").value;
  const selectedDate = expenseDateInput.value || toDateInputValue(new Date());
  const selectedDateObject = new Date(`${selectedDate}T12:00:00`);

  if (!amount || amount <= 0) {
    showToast("Введи сумму больше 0", "error");
    return;
  }

  if (!isDateInSelectedMonth(selectedDateObject)) {
    showToast("Дата должна быть в выбранном месяце", "error");
    return;
  }

  try {
    await apiFetch("/expenses", {
      method: "POST",
      body: JSON.stringify({
        amount,
        category,
        comment,
        date: `${selectedDate}T12:00:00`,
      }),
    });

    document.getElementById("amountInput").value = "";
    document.getElementById("commentInput").value = "";
    setDefaultExpenseDate();

    await loadData();

    showToast("Расход добавлен");
    setTimeout(showDailyLimitWarningIfNeeded, 700);
  } catch (error) {
    console.error(error);

    if (error.message !== "Unauthorized") {
      showToast("Ошибка добавления расхода", "error");
    }
  }
};

// ===== FILTERS =====
if (expenseCategoryFilterInput) {
  expenseCategoryFilterInput.onchange = () => {
    expenseCategoryFilter = expenseCategoryFilterInput.value;
    renderExpenses();
  };
}

if (expensePeriodFilterInput) {
  expensePeriodFilterInput.onchange = () => {
    expensePeriodFilter = expensePeriodFilterInput.value;
    renderExpenses();
  };
}

if (expenseSearchInput) {
  expenseSearchInput.oninput = () => {
    expenseSearchQuery = expenseSearchInput.value.trim().toLowerCase();
    renderExpenses();
  };
}

if (resetExpenseFiltersBtn) {
  resetExpenseFiltersBtn.onclick = () => {
    expenseCategoryFilter = "all";
    expensePeriodFilter = "month";
    expenseSearchQuery = "";

    expenseCategoryFilterInput.value = "all";
    expensePeriodFilterInput.value = "month";
    expenseSearchInput.value = "";

    renderExpenses();
    showToast("Фильтры сброшены");
  };
}

// ===== CALCULATIONS =====
function calculate() {
  const now = new Date();

  const isCurrentMonth =
    selectedMonth === now.getMonth() + 1 &&
    selectedYear === now.getFullYear();

  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();

  const spent = expenses.reduce((sum, e) => {
    return sum + Number(e.amount);
  }, 0);

  const left = budget - spent;

  let todaySpent = 0;
  let todayLimit = 0;
  let todayRemaining = 0;
  let exceededToday = 0;
  let nextDailyLimit = 0;
  let daysLeft = lastDay;

  if (isCurrentMonth) {
    const currentDay = now.getDate();

    daysLeft = lastDay - currentDay + 1;

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const spentBeforeToday = expenses
      .filter((expense) => {
        const expenseDate = new Date(expense.date);
        return expenseDate < startOfToday;
      })
      .reduce((sum, expense) => sum + Number(expense.amount), 0);

    todaySpent = expenses
      .filter((expense) => isSameDay(new Date(expense.date), now))
      .reduce((sum, expense) => sum + Number(expense.amount), 0);

    const availableFromToday = budget - spentBeforeToday;
    const rawTodayLimit = availableFromToday / daysLeft;

    todayLimit = Math.max(0, rawTodayLimit);
    todayRemaining = Math.max(0, todayLimit - todaySpent);
    exceededToday = Math.max(0, todaySpent - todayLimit);

    const daysAfterToday = lastDay - currentDay;
    const leftAfterToday = budget - spentBeforeToday - todaySpent;

    nextDailyLimit =
      daysAfterToday > 0
        ? Math.max(0, leftAfterToday / daysAfterToday)
        : 0;
  } else {
    const rawDailyLimit = left / lastDay;

    todayLimit = Math.max(0, rawDailyLimit);
    todayRemaining = Math.max(0, todayLimit);
    exceededToday = 0;
    nextDailyLimit = Math.max(0, rawDailyLimit);
  }

  return {
    left,
    spent,
    todaySpent,
    todayLimit,
    todayRemaining,
    exceededToday,
    nextDailyLimit,
    daysLeft,
  };
}

function showDailyLimitWarningIfNeeded() {
  const now = new Date();

  const isCurrentMonth =
    selectedMonth === now.getMonth() + 1 &&
    selectedYear === now.getFullYear();

  if (!isCurrentMonth) return;

  const { todaySpent, todayLimit, exceededToday } = calculate();

  if (exceededToday <= 0 || todaySpent <= 0) return;

  const warningKey = `${selectedYear}-${selectedMonth}-${now.getDate()}-${todaySpent.toFixed(2)}-${todayLimit.toFixed(2)}`;

  if (warningKey === lastLimitWarningKey) return;

  lastLimitWarningKey = warningKey;

  showToast(
    `Лимит дня превышен на ${exceededToday.toFixed(2)} €`,
    "warning"
  );
}

// ===== RENDER =====
function render() {
  const {
    left,
    spent,
    todaySpent,
    todayLimit,
    todayRemaining,
    exceededToday,
    nextDailyLimit,
    daysLeft,
  } = calculate();

  document.getElementById("monthLeft").textContent = `${left.toFixed(2)} €`;
  document.getElementById("dailyLimit").textContent = `${todayRemaining.toFixed(2)} €`;

  const monthSpent = document.getElementById("monthSpent");
  const todaySpentLabel = document.getElementById("todaySpentLabel");
  const nextDailyLimitLabel = document.getElementById("nextDailyLimitLabel");
  const daysLeftLabel = document.getElementById("daysLeftLabel");
  const limitOverLabel = document.getElementById("limitOverLabel");

  if (monthSpent) {
    monthSpent.textContent = `Потрачено: ${spent.toFixed(2)} €`;
  }

  if (todaySpentLabel) {
    todaySpentLabel.textContent =
      `Сегодня: ${todaySpent.toFixed(2)} / ${todayLimit.toFixed(2)} €`;
  }

  if (nextDailyLimitLabel) {
    if (daysLeft <= 1) {
      nextDailyLimitLabel.textContent = "Дальше в день: —";
    } else {
      nextDailyLimitLabel.textContent =
        `Дальше в день: ${nextDailyLimit.toFixed(2)} €`;
    }
  }

  if (daysLeftLabel) {
    daysLeftLabel.textContent = `Дней осталось: ${daysLeft}`;
  }

  if (limitOverLabel) {
    if (exceededToday > 0) {
      limitOverLabel.textContent = `Превышено на ${exceededToday.toFixed(2)} €`;
    } else {
      limitOverLabel.textContent = "";
    }
  }

  const limitCard = document.getElementById("limitCard");

  limitCard.classList.remove("good", "warning", "bad");

  if (left <= 0 || todayLimit <= 0 || exceededToday > 0) {
    limitCard.classList.add("bad");
  } else if (
    todayRemaining <= 5 ||
    (todayLimit > 0 && todayRemaining / todayLimit <= 0.2)
  ) {
    limitCard.classList.add("warning");
  } else {
    limitCard.classList.add("good");
  }

  renderExpenses();
  renderAnalytics(spent, todaySpent);
}

// ===== ANALYTICS =====
function renderAnalytics(totalSpent, todaySpent) {
  if (analyticsTotalSpent) {
    analyticsTotalSpent.textContent = `${totalSpent.toFixed(2)} €`;
  }

  if (analyticsTodaySpent) {
    analyticsTodaySpent.textContent = `${todaySpent.toFixed(2)} €`;
  }

  const categoryTotals = getCategoryTotals();
  const sortedCategories = Object.entries(categoryTotals).sort(
    (a, b) => b[1] - a[1]
  );

  if (analyticsTopCategory) {
    if (sortedCategories.length === 0) {
      analyticsTopCategory.textContent = "—";
    } else {
      const [topCategory, topAmount] = sortedCategories[0];
      analyticsTopCategory.textContent = `${getCategoryName(topCategory)} · ${topAmount.toFixed(2)} €`;
    }
  }

  if (!categoryStatsList) return;

  categoryStatsList.innerHTML = "";

  if (sortedCategories.length === 0) {
    categoryStatsList.innerHTML = `<p class="analytics-empty">Пока нет данных</p>`;
    return;
  }

  sortedCategories.forEach(([category, amount]) => {
    const percent = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;

    const item = document.createElement("div");
    item.className = "category-stat-item";

    item.innerHTML = `
      <div class="category-stat-top">
        <span>${getCategoryIcon(category)} ${getCategoryName(category)}</span>
        <strong>${amount.toFixed(2)} €</strong>
      </div>

      <div class="category-stat-bar">
        <span style="width: ${percent}%"></span>
      </div>
    `;

    categoryStatsList.appendChild(item);
  });
}

function getCategoryTotals() {
  return expenses.reduce((totals, expense) => {
    const category = expense.category || "other";

    if (!totals[category]) {
      totals[category] = 0;
    }

    totals[category] += Number(expense.amount);

    return totals;
  }, {});
}

// ===== EXPENSES LIST =====
function renderExpenses() {
  const list = document.getElementById("expensesList");
  const filteredExpenses = getFilteredExpenses();

  list.innerHTML = "";

  if (filteredExpenses.length === 0) {
    list.innerHTML = `<p class="expense-empty">Расходов пока нет</p>`;
    return;
  }

  filteredExpenses.forEach((expense) => {
    const div = document.createElement("div");
    div.className = "expense-item";
    div.onclick = () => openEditExpense(expense.id);

    const categoryIcon = getCategoryIcon(expense.category);
    const categoryName = getCategoryName(expense.category);
    const comment = expense.comment ? escapeHtml(expense.comment) : "Без комментария";
    const formattedDate = formatExpenseDate(expense.date);

    div.innerHTML = `
      <div class="expense-icon">${categoryIcon}</div>

      <div class="expense-info">
        <div class="expense-title-row">
          <strong>${categoryName}</strong>
          <span class="expense-amount">${Number(expense.amount).toFixed(2)} €</span>
        </div>

        <div class="expense-meta-row">
          <span>${comment}</span>
          <span>${formattedDate}</span>
        </div>
      </div>
    `;

    list.appendChild(div);
  });
}

function getFilteredExpenses() {
  return expenses.filter((expense) => {
    const expenseDate = new Date(expense.date);
    const comment = (expense.comment || "").toLowerCase();
    const categoryLabel = getCategoryName(expense.category).toLowerCase();

    const matchesCategory =
      expenseCategoryFilter === "all" ||
      expense.category === expenseCategoryFilter;

    const matchesSearch =
      !expenseSearchQuery ||
      comment.includes(expenseSearchQuery) ||
      categoryLabel.includes(expenseSearchQuery);

    const matchesPeriod = filterExpenseByPeriod(expenseDate);

    return matchesCategory && matchesSearch && matchesPeriod;
  });
}

function filterExpenseByPeriod(expenseDate) {
  const today = new Date();

  if (expensePeriodFilter === "today") {
    return isSameDay(expenseDate, today);
  }

  if (expensePeriodFilter === "week") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return expenseDate >= sevenDaysAgo && expenseDate <= today;
  }

  return true;
}

function formatExpenseDate(dateString) {
  const expenseDate = new Date(dateString);
  const today = new Date();

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(expenseDate, today)) {
    return "Сегодня";
  }

  if (isSameDay(expenseDate, yesterday)) {
    return "Вчера";
  }

  return expenseDate.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isSameDay(dateA, dateB) {
  return (
    dateA.getDate() === dateB.getDate() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getFullYear() === dateB.getFullYear()
  );
}

function getCategoryIcon(category) {
  const categories = {
    food: "🍔",
    transport: "🚌",
    shopping: "🛒",
    home: "🏠",
    fun: "🎮",
    other: "📦",
  };

  return categories[category] || "📦";
}

function getCategoryName(category) {
  const categories = {
    food: "Еда",
    transport: "Транспорт",
    shopping: "Магазины",
    home: "Дом",
    fun: "Развлечения",
    other: "Другое",
  };

  return categories[category] || "Другое";
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== EDIT EXPENSE =====
function openEditExpense(id) {
  const expense = expenses.find((e) => Number(e.id) === Number(id));

  if (!expense) {
    showToast("Расход не найден", "error");
    return;
  }

  editingExpenseId = expense.id;

  editAmountInput.value = Number(expense.amount);
  editCategoryInput.value = expense.category;
  editExpenseDateInput.value = toDateInputValue(new Date(expense.date));
  editCommentInput.value = expense.comment || "";

  editExpenseModal.classList.add("open");
  showOverlay();
}

function closeEditExpense() {
  editExpenseModal.classList.remove("open");
  editingExpenseId = null;

  editAmountInput.value = "";
  editCommentInput.value = "";
  editExpenseDateInput.value = "";

  if (!confirmModal.classList.contains("open")) {
    hideOverlay();
  }
}

closeEditExpenseBtn.onclick = closeEditExpense;

saveEditExpenseBtn.onclick = async () => {
  if (!currentUser || !editingExpenseId) return;

  const amount = parseFloat(editAmountInput.value);
  const category = editCategoryInput.value;
  const comment = editCommentInput.value;
  const selectedDate = editExpenseDateInput.value;
  const selectedDateObject = new Date(`${selectedDate}T12:00:00`);

  if (!amount || amount <= 0) {
    showToast("Введи нормальную сумму", "error");
    return;
  }

  if (!selectedDate || Number.isNaN(selectedDateObject.getTime())) {
    showToast("Выбери корректную дату", "error");
    return;
  }

  if (!isDateInSelectedMonth(selectedDateObject)) {
    showToast("Дата должна быть в выбранном месяце", "error");
    return;
  }

  try {
    await apiFetch(`/expenses/${editingExpenseId}`, {
      method: "PUT",
      body: JSON.stringify({
        amount,
        category,
        comment,
        date: `${selectedDate}T12:00:00`,
      }),
    });

    await loadData();
    closeEditExpense();

    showToast("Расход сохранён");
    setTimeout(showDailyLimitWarningIfNeeded, 700);
  } catch (error) {
    console.error(error);

    if (error.message !== "Unauthorized") {
      showToast("Ошибка сохранения расхода", "error");
    }
  }
};

deleteEditExpenseBtn.onclick = async () => {
  if (!editingExpenseId) return;

  const expenseIdToDelete = editingExpenseId;

  openConfirm({
    title: "Удалить расход?",
    message: "Это действие нельзя отменить.",
    confirmText: "Удалить",
    type: "danger",
    onConfirm: async () => {
      try {
        await deleteExpense(expenseIdToDelete);
        closeEditExpense();
        showToast("Расход удалён");
      } catch (error) {
        console.error(error);

        if (error.message !== "Unauthorized") {
          showToast("Ошибка удаления расхода", "error");
        }
      }
    },
  });
};

// ===== DELETE EXPENSE =====
async function deleteExpense(id) {
  if (!currentUser) return;

  await apiFetch(`/expenses/${id}`, {
    method: "DELETE",
  });

  await loadData();
}

// ===== INIT =====
setDefaultExpenseDate();
renderCurrentMonth();
render();
initSession();
